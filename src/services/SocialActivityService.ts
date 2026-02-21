/**
 * Social Activity Service
 * Handles Follow, Like, Announce, and other social activities
 */

import type {
  Activity,
  Follow,
  Accept,
  Reject,
  Like,
  Announce,
  Undo
} from '../types/activitystreams.js';
import {
  addFollower,
  removeFollower,
  acceptFollowRequest,
  rejectFollowRequest,
  buildFollowerFromActivity,
  extractHandleFromUri,
} from './FollowersService.js';
import {
  acceptFollow as acceptOutgoingFollow,
  rejectFollow as rejectOutgoingFollow
} from './FollowService.js';
import {
  getActorUri,
  getActivityPubConfig,
  getActivityPubDir
} from '../config.js';
import { queueForDelivery } from './ActivityDeliveryService.js';
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  readdirSync
} from 'fs';
import { join } from 'path';
import crypto from 'crypto';

// ============================================================================
// Type Definitions
// ============================================================================

export interface LikeRecord {
  id: string;
  activityId: string;
  actorUri: string;
  actorHandle: string;
  objectId: string;
  likedAt: string;
}

export interface AnnounceRecord {
  id: string;
  activityId: string;
  actorUri: string;
  actorHandle: string;
  objectId: string;
  announcedAt: string;
}

export interface Notification {
  id: string;
  type: 'follow' | 'follow_accepted' | 'follow_rejected' | 'like' | 'announce' | 'mention' | 'reply';
  actorUri: string;
  actorHandle: string;
  actorName?: string;
  actorAvatar?: string;
  targetUri: string;
  activityId: string;
  createdAt: string;
  read: boolean;
  content?: string;
}

// ============================================================================
// Directory Initialization
// ============================================================================

function getLikesDir(): string {
  return join(getActivityPubDir(), 'likes');
}

function getAnnouncesDir(): string {
  return join(getActivityPubDir(), 'announces');
}

function getNotificationsDir(): string {
  return join(getActivityPubDir(), 'notifications');
}

function getRemoteContentDir(): string {
  return join(getActivityPubDir(), 'remote-content');
}

function ensureSocialDirs(): void {
  for (const dir of [getLikesDir(), getAnnouncesDir(), getNotificationsDir(), getRemoteContentDir()]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// ============================================================================
// Follow Activity Handling
// ============================================================================

/**
 * Handle incoming Follow activity
 */
export async function handleFollowActivity(
  activity: Follow,
  localActorHandle: string
): Promise<void> {
  const config = getActivityPubConfig();

  // Validate activity
  if (!activity.object || typeof activity.object !== 'string') {
    throw new Error('Invalid Follow activity: missing object');
  }

  // Extract follower information
  const follower = buildFollowerFromActivity(activity, 'pending');

  if (!follower) {
    throw new Error('Invalid Follow activity: could not build follower');
  }

  // Add follower with pending status
  addFollower(localActorHandle, follower);

  // Create notification
  createNotification(localActorHandle, {
    id: crypto.randomUUID(),
    type: 'follow',
    actorUri: follower.actorUri,
    actorHandle: follower.handle,
    actorName: follower.displayName,
    actorAvatar: follower.avatarUrl,
    targetUri: getActorUri(localActorHandle),
    activityId: activity.id,
    createdAt: activity.published || new Date().toISOString(),
    read: false
  });

  // Auto-approve or manual approval
  if (config.autoApproveFollows) {
    await acceptFollow(localActorHandle, activity);
  } else {
    console.log(`[SocialActivityService] Follow request from ${follower.handle} pending approval`);
  }
}

/**
 * Accept a follow request
 */
export async function acceptFollow(
  localActorHandle: string,
  followActivity: Follow
): Promise<void> {
  const followerUri = typeof followActivity.actor === 'string'
    ? followActivity.actor
    : followActivity.actor.id;

  // Update follower status
  acceptFollowRequest(localActorHandle, followerUri);

  // Create Accept activity
  const acceptActivity: Accept = {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1'
    ],
    id: `${getActorUri(localActorHandle)}/activities/${crypto.randomUUID()}`,
    type: 'Accept',
    actor: getActorUri(localActorHandle),
    object: followActivity,
    to: [followerUri],
    published: new Date().toISOString()
  };

  // Deliver Accept activity to follower
  await queueForDelivery(acceptActivity, [followerUri]);

  console.log(`[SocialActivityService] Follow from ${followerUri} accepted`);
}

/**
 * Reject a follow request
 */
export async function rejectFollow(
  localActorHandle: string,
  followActivity: Follow
): Promise<void> {
  const followerUri = typeof followActivity.actor === 'string'
    ? followActivity.actor
    : followActivity.actor.id;

  // Update follower status
  rejectFollowRequest(localActorHandle, followerUri);

  // Create Reject activity
  const rejectActivity: Reject = {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1'
    ],
    id: `${getActorUri(localActorHandle)}/activities/${crypto.randomUUID()}`,
    type: 'Reject',
    actor: getActorUri(localActorHandle),
    object: followActivity,
    to: [followerUri],
    published: new Date().toISOString()
  };

  // Deliver Reject activity to follower
  await queueForDelivery(rejectActivity, [followerUri]);

  console.log(`[SocialActivityService] Follow from ${followerUri} rejected`);
}

// ============================================================================
// Accept/Reject Activity Handling (for outgoing follow requests)
// ============================================================================

/**
 * Handle incoming Accept activity
 * Called when a remote actor accepts our follow request
 */
export async function handleAcceptActivity(
  activity: Accept,
  localActorHandle: string
): Promise<{ success: boolean; remoteActorUri?: string; error?: string }> {
  console.log(`[SocialActivityService] Processing Accept activity: ${activity.id}`);

  // The object should be the Follow activity that was accepted
  const followActivity = activity.object;

  if (!followActivity) {
    console.error(`[SocialActivityService] Accept activity missing object`);
    return { success: false, error: 'Accept activity missing object' };
  }

  // Extract the remote actor URI (the actor who sent the Accept)
  const remoteActorUri = typeof activity.actor === 'string'
    ? activity.actor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (activity.actor as any).id;

  if (!remoteActorUri) {
    console.error(`[SocialActivityService] Accept activity missing actor`);
    return { success: false, error: 'Accept activity missing actor' };
  }

  // Validate that the Follow object references the correct actors
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let followObject: any = followActivity;

  // Handle case where object is a URI reference
  if (typeof followActivity === 'string') {
    console.log(`[SocialActivityService] Accept references Follow by URI: ${followActivity}`);
  } else if (typeof followActivity === 'object') {
    followObject = followActivity;

    // Verify this is a Follow activity
    if (followObject.type !== 'Follow') {
      console.error(`[SocialActivityService] Accept object is not a Follow activity: ${followObject.type}`);
      return { success: false, error: `Accept object is not a Follow: ${followObject.type}` };
    }

    // Verify the Follow was targeting the remote actor
    const followTarget = typeof followObject.object === 'string'
      ? followObject.object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (followObject.object as any)?.id;

    if (followTarget && followTarget !== remoteActorUri) {
      console.warn(`[SocialActivityService] Accept actor (${remoteActorUri}) doesn't match Follow target (${followTarget})`);
    }
  }

  // Update the following status from pending to accepted
  const updated = acceptOutgoingFollow(localActorHandle, remoteActorUri);

  if (!updated) {
    console.warn(`[SocialActivityService] No pending follow found for ${remoteActorUri}`);
    return { success: false, error: 'No pending follow found', remoteActorUri };
  }

  // Extract actor info for notification
  const actorHandle = extractHandleFromUri(remoteActorUri) || 'unknown';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actorName = typeof activity.actor === 'object' ? (activity.actor as any).name : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actorAvatar = typeof activity.actor === 'object' ? (activity.actor as any).icon?.url : undefined;

  // Create notification for the local user
  createNotification(localActorHandle, {
    id: crypto.randomUUID(),
    type: 'follow_accepted',
    actorUri: remoteActorUri,
    actorHandle,
    actorName,
    actorAvatar,
    targetUri: getActorUri(localActorHandle),
    activityId: activity.id,
    createdAt: activity.published || new Date().toISOString(),
    read: false,
    content: `${actorHandle} accepted your follow request`
  });

  console.log(`[SocialActivityService] Follow accepted by ${remoteActorUri}`);
  return { success: true, remoteActorUri };
}

/**
 * Handle incoming Reject activity
 * Called when a remote actor rejects our follow request
 */
export async function handleRejectActivity(
  activity: Reject,
  localActorHandle: string
): Promise<{ success: boolean; remoteActorUri?: string; error?: string }> {
  console.log(`[SocialActivityService] Processing Reject activity: ${activity.id}`);

  const followActivity = activity.object;

  if (!followActivity) {
    console.error(`[SocialActivityService] Reject activity missing object`);
    return { success: false, error: 'Reject activity missing object' };
  }

  const remoteActorUri = typeof activity.actor === 'string'
    ? activity.actor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (activity.actor as any).id;

  if (!remoteActorUri) {
    console.error(`[SocialActivityService] Reject activity missing actor`);
    return { success: false, error: 'Reject activity missing actor' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let followObject: any = followActivity;

  if (typeof followActivity === 'string') {
    console.log(`[SocialActivityService] Reject references Follow by URI: ${followActivity}`);
  } else if (typeof followActivity === 'object') {
    followObject = followActivity;

    if (followObject.type !== 'Follow') {
      console.error(`[SocialActivityService] Reject object is not a Follow activity: ${followObject.type}`);
      return { success: false, error: `Reject object is not a Follow: ${followObject.type}` };
    }
  }

  const removed = rejectOutgoingFollow(localActorHandle, remoteActorUri);

  if (!removed) {
    console.warn(`[SocialActivityService] No pending follow found for ${remoteActorUri}`);
    return { success: false, error: 'No pending follow found', remoteActorUri };
  }

  const actorHandle = extractHandleFromUri(remoteActorUri) || 'unknown';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actorName = typeof activity.actor === 'object' ? (activity.actor as any).name : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actorAvatar = typeof activity.actor === 'object' ? (activity.actor as any).icon?.url : undefined;

  createNotification(localActorHandle, {
    id: crypto.randomUUID(),
    type: 'follow_rejected',
    actorUri: remoteActorUri,
    actorHandle,
    actorName,
    actorAvatar,
    targetUri: getActorUri(localActorHandle),
    activityId: activity.id,
    createdAt: activity.published || new Date().toISOString(),
    read: false,
    content: `${actorHandle} declined your follow request`
  });

  console.log(`[SocialActivityService] Follow rejected by ${remoteActorUri}`);
  return { success: true, remoteActorUri };
}

/**
 * Handle Undo activity (typically for unfollowing)
 */
export async function handleUndoActivity(
  activity: Undo,
  localActorHandle: string
): Promise<void> {
  const object = activity.object;

  // Handle Undo Follow (unfollow)
  if (typeof object === 'object' && 'type' in object && object.type === 'Follow') {
    const followerUri = typeof activity.actor === 'string'
      ? activity.actor
      : activity.actor.id;

    removeFollower(localActorHandle, followerUri);
    console.log(`[SocialActivityService] Unfollow from ${followerUri}`);
  }

  // Handle Undo Like (unlike)
  if (typeof object === 'object' && 'type' in object && 'id' in object && object.type === 'Like') {
    const likeUri = object.id;
    removeLikeRecord(likeUri);
    console.log(`[SocialActivityService] Unlike ${likeUri}`);
  }

  // Handle Undo Announce (unboost)
  if (typeof object === 'object' && 'type' in object && 'id' in object && object.type === 'Announce') {
    const announceUri = object.id;
    removeAnnounceRecord(announceUri);
    console.log(`[SocialActivityService] Unannounce ${announceUri}`);
  }
}

// ============================================================================
// Like Activity Handling
// ============================================================================

/**
 * Handle incoming Like activity
 */
export function handleLikeActivity(
  activity: Like,
  localActorHandle: string
): void {
  ensureSocialDirs();

  if (!activity.object || typeof activity.object !== 'string') {
    throw new Error('Invalid Like activity: missing object');
  }

  if (existsSync(getLikeRecordPath(activity.id))) {
    console.log(`[SocialActivityService] Like ${activity.id} already exists`);
    return;
  }

  const actorUri = typeof activity.actor === 'string'
    ? activity.actor
    : activity.actor.id;

  const actorHandle = extractHandleFromUri(actorUri) || 'unknown';

  const likeRecord: LikeRecord = {
    id: crypto.randomUUID(),
    activityId: activity.id,
    actorUri,
    actorHandle,
    objectId: activity.object,
    likedAt: activity.published || new Date().toISOString()
  };

  const recordPath = getLikeRecordPath(activity.id);
  writeFileSync(recordPath, JSON.stringify(likeRecord, null, 2), 'utf-8');

  createNotification(localActorHandle, {
    id: crypto.randomUUID(),
    type: 'like',
    actorUri,
    actorHandle,
    actorName: typeof activity.actor === 'object' ? activity.actor.name : undefined,
    actorAvatar: typeof activity.actor === 'object' && activity.actor.icon && typeof activity.actor.icon === 'object'
      ? ('url' in activity.actor.icon ? activity.actor.icon.url : 'href' in activity.actor.icon ? activity.actor.icon.href : undefined)
      : undefined,
    targetUri: activity.object,
    activityId: activity.id,
    createdAt: activity.published || new Date().toISOString(),
    read: false
  });

  console.log(`[SocialActivityService] Like recorded: ${activity.id}`);
}

/**
 * Get like records for an object
 */
export function getLikesForObject(objectUri: string): LikeRecord[] {
  ensureSocialDirs();
  const likes: LikeRecord[] = [];
  const likesDir = getLikesDir();

  const files = readdirSync(likesDir).filter(file => file.endsWith('.json'));

  for (const file of files) {
    try {
      const content = readFileSync(join(likesDir, file), 'utf-8');
      const like = JSON.parse(content) as LikeRecord;

      if (like.objectId === objectUri) {
        likes.push(like);
      }
    } catch (err) {
      console.error(`[SocialActivityService] Failed to load like record:`, err);
    }
  }

  return likes;
}

/**
 * Get like count for an object
 */
export function getLikeCount(objectUri: string): number {
  return getLikesForObject(objectUri).length;
}

/**
 * Remove a like record
 */
function removeLikeRecord(activityId: string): void {
  const recordPath = getLikeRecordPath(activityId);

  if (existsSync(recordPath)) {
    try {
      unlinkSync(recordPath);
    } catch (err) {
      console.error(`[SocialActivityService] Failed to remove like record:`, err);
    }
  }
}

function getLikeRecordPath(activityId: string): string {
  return join(getLikesDir(), `${activityId}.json`);
}

// ============================================================================
// Announce (Boost) Activity Handling
// ============================================================================

/**
 * Handle incoming Announce activity
 */
export function handleAnnounceActivity(
  activity: Announce,
  localActorHandle: string
): void {
  ensureSocialDirs();

  if (!activity.object || typeof activity.object !== 'string') {
    throw new Error('Invalid Announce activity: missing object');
  }

  if (existsSync(getAnnounceRecordPath(activity.id))) {
    console.log(`[SocialActivityService] Announce ${activity.id} already exists`);
    return;
  }

  const actorUri = typeof activity.actor === 'string'
    ? activity.actor
    : activity.actor.id;

  const actorHandle = extractHandleFromUri(actorUri) || 'unknown';

  const announceRecord: AnnounceRecord = {
    id: crypto.randomUUID(),
    activityId: activity.id,
    actorUri,
    actorHandle,
    objectId: activity.object,
    announcedAt: activity.published || new Date().toISOString()
  };

  const recordPath = getAnnounceRecordPath(activity.id);
  writeFileSync(recordPath, JSON.stringify(announceRecord, null, 2), 'utf-8');

  createNotification(localActorHandle, {
    id: crypto.randomUUID(),
    type: 'announce',
    actorUri,
    actorHandle,
    actorName: typeof activity.actor === 'object' ? activity.actor.name : undefined,
    actorAvatar: typeof activity.actor === 'object' && activity.actor.icon && typeof activity.actor.icon === 'object'
      ? ('url' in activity.actor.icon ? activity.actor.icon.url : 'href' in activity.actor.icon ? activity.actor.icon.href : undefined)
      : undefined,
    targetUri: activity.object,
    activityId: activity.id,
    createdAt: activity.published || new Date().toISOString(),
    read: false
  });

  console.log(`[SocialActivityService] Announce recorded: ${activity.id}`);
}

/**
 * Get announce records for an object
 */
export function getAnnouncesForObject(objectUri: string): AnnounceRecord[] {
  ensureSocialDirs();
  const announces: AnnounceRecord[] = [];
  const announcesDir = getAnnouncesDir();

  const files = readdirSync(announcesDir).filter(file => file.endsWith('.json'));

  for (const file of files) {
    try {
      const content = readFileSync(join(announcesDir, file), 'utf-8');
      const announce = JSON.parse(content) as AnnounceRecord;

      if (announce.objectId === objectUri) {
        announces.push(announce);
      }
    } catch (err) {
      console.error(`[SocialActivityService] Failed to load announce record:`, err);
    }
  }

  return announces;
}

/**
 * Get announce (boost) count for an object
 */
export function getAnnounceCount(objectUri: string): number {
  return getAnnouncesForObject(objectUri).length;
}

function removeAnnounceRecord(activityId: string): void {
  const recordPath = getAnnounceRecordPath(activityId);

  if (existsSync(recordPath)) {
    try {
      unlinkSync(recordPath);
    } catch (err) {
      console.error(`[SocialActivityService] Failed to remove announce record:`, err);
    }
  }
}

function getAnnounceRecordPath(activityId: string): string {
  return join(getAnnouncesDir(), `${activityId}.json`);
}

// ============================================================================
// Notification Management
// ============================================================================

/**
 * Create a notification for a user
 */
export function createNotification(
  actorHandle: string,
  notification: Notification
): void {
  ensureSocialDirs();
  const notificationPath = join(getNotificationsDir(), `${actorHandle}.json`);

  let notifications: Notification[] = [];

  if (existsSync(notificationPath)) {
    try {
      const content = readFileSync(notificationPath, 'utf-8');
      notifications = JSON.parse(content) as Notification[];
    } catch (err) {
      console.error(`[SocialActivityService] Failed to load notifications for ${actorHandle}:`, err);
    }
  }

  // Add new notification
  notifications.unshift(notification);

  // Limit to 100 notifications
  if (notifications.length > 100) {
    notifications = notifications.slice(0, 100);
  }

  writeFileSync(notificationPath, JSON.stringify(notifications, null, 2), 'utf-8');
}

/**
 * Get all notifications for a user
 */
export function getNotifications(
  actorHandle: string,
  includeRead = false
): Notification[] {
  ensureSocialDirs();
  const notificationPath = join(getNotificationsDir(), `${actorHandle}.json`);

  if (!existsSync(notificationPath)) {
    return [];
  }

  try {
    const content = readFileSync(notificationPath, 'utf-8');
    const notifications: Notification[] = JSON.parse(content);

    if (includeRead) {
      return notifications;
    }

    return notifications.filter(n => !n.read);
  } catch (err) {
    console.error(`[SocialActivityService] Failed to get notifications:`, err);
    return [];
  }
}

/**
 * Mark notification as read
 */
export function markNotificationAsRead(
  actorHandle: string,
  notificationId: string
): void {
  ensureSocialDirs();
  const notificationPath = join(getNotificationsDir(), `${actorHandle}.json`);

  if (!existsSync(notificationPath)) {
    return;
  }

  try {
    const content = readFileSync(notificationPath, 'utf-8');
    const notifications: Notification[] = JSON.parse(content);

    const notification = notifications.find(n => n.id === notificationId);

    if (notification) {
      notification.read = true;
      writeFileSync(notificationPath, JSON.stringify(notifications, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error(`[SocialActivityService] Failed to mark notification as read:`, err);
  }
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsAsRead(actorHandle: string): void {
  ensureSocialDirs();
  const notificationPath = join(getNotificationsDir(), `${actorHandle}.json`);

  if (!existsSync(notificationPath)) {
    return;
  }

  try {
    const content = readFileSync(notificationPath, 'utf-8');
    const notifications: Notification[] = JSON.parse(content);

    notifications.forEach(n => n.read = true);

    writeFileSync(notificationPath, JSON.stringify(notifications, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[SocialActivityService] Failed to mark all notifications as read:`, err);
  }
}

/**
 * Get unread notification count
 */
export function getUnreadNotificationCount(actorHandle: string): number {
  return getNotifications(actorHandle, false).length;
}

// ============================================================================
// Create/Update/Delete Activity Handling
// ============================================================================

/**
 * Handle incoming Create activity
 * Stores content from remote actors for display in timeline
 */
export async function handleCreateActivity(
  activity: Activity,
  localActorHandle: string
): Promise<void> {
  ensureSocialDirs();

  if (!activity.object) {
    throw new Error('Invalid Create activity: missing object');
  }

  const actorUri = typeof activity.actor === 'string'
    ? activity.actor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (activity.actor as any).id;

  const actorHandle = extractHandleFromUri(actorUri) || 'unknown';

  const object = typeof activity.object === 'string'
    ? { id: activity.object, type: 'Unknown' }
    : activity.object;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objectId = (object as any).id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objectType = (object as any).type || 'Unknown';

  console.log(`[SocialActivityService] Create activity from ${actorHandle}: ${objectType}`);

  const contentRecord = {
    id: crypto.randomUUID(),
    activityId: activity.id,
    objectId,
    objectType,
    actorUri,
    actorHandle,
    object,
    receivedAt: new Date().toISOString(),
    published: activity.published || new Date().toISOString()
  };

  const contentPath = join(getRemoteContentDir(), localActorHandle);
  if (!existsSync(contentPath)) {
    mkdirSync(contentPath, { recursive: true });
  }

  const recordPath = join(contentPath, `${contentRecord.id}.json`);
  writeFileSync(recordPath, JSON.stringify(contentRecord, null, 2), 'utf-8');

  // Create notification for mentions or replies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mentions = (object as any).tag?.filter((t: any) => t.type === 'Mention') || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inReplyTo = (object as any).inReplyTo;

  if (mentions.length > 0 || inReplyTo) {
    createNotification(localActorHandle, {
      id: crypto.randomUUID(),
      type: inReplyTo ? 'reply' : 'mention',
      actorUri,
      actorHandle,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actorName: typeof activity.actor === 'object' ? (activity.actor as any).name : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actorAvatar: typeof activity.actor === 'object' ? (activity.actor as any).icon?.url : undefined,
      targetUri: objectId,
      activityId: activity.id,
      createdAt: activity.published || new Date().toISOString(),
      read: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: (object as any).content?.substring(0, 200)
    });
  }

  console.log(`[SocialActivityService] Stored remote content: ${objectId}`);
}

/**
 * Handle incoming Update activity
 */
export async function handleUpdateActivity(
  activity: Activity,
  localActorHandle: string
): Promise<void> {
  ensureSocialDirs();

  if (!activity.object) {
    throw new Error('Invalid Update activity: missing object');
  }

  const object = typeof activity.object === 'string'
    ? { id: activity.object }
    : activity.object;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objectId = (object as any).id;

  console.log(`[SocialActivityService] Update activity for: ${objectId}`);

  const contentPath = join(getRemoteContentDir(), localActorHandle);
  if (!existsSync(contentPath)) {
    console.log(`[SocialActivityService] No remote content directory for ${localActorHandle}`);
    return;
  }

  const files = readdirSync(contentPath).filter((file: string) => file.endsWith('.json'));

  for (const file of files) {
    try {
      const filePath = join(contentPath, file);
      const content = readFileSync(filePath, 'utf-8');
      const record = JSON.parse(content);

      if (record.objectId === objectId) {
        record.object = typeof activity.object === 'object' ? activity.object : record.object;
        record.updatedAt = new Date().toISOString();
        record.updateActivityId = activity.id;

        writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
        console.log(`[SocialActivityService] Updated remote content: ${objectId}`);
        return;
      }
    } catch (err) {
      console.error(`[SocialActivityService] Failed to check file ${file}:`, err);
    }
  }

  console.log(`[SocialActivityService] Content not found for update: ${objectId}`);
}

/**
 * Handle incoming Delete activity
 */
export async function handleDeleteActivity(
  activity: Activity,
  localActorHandle: string
): Promise<void> {
  ensureSocialDirs();

  if (!activity.object) {
    throw new Error('Invalid Delete activity: missing object');
  }

  const objectId = typeof activity.object === 'string'
    ? activity.object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (activity.object as any).id;

  console.log(`[SocialActivityService] Delete activity for: ${objectId}`);

  const contentPath = join(getRemoteContentDir(), localActorHandle);
  if (!existsSync(contentPath)) {
    console.log(`[SocialActivityService] No remote content directory for ${localActorHandle}`);
    return;
  }

  const files = readdirSync(contentPath).filter((file: string) => file.endsWith('.json'));

  for (const file of files) {
    try {
      const filePath = join(contentPath, file);
      const content = readFileSync(filePath, 'utf-8');
      const record = JSON.parse(content);

      if (record.objectId === objectId) {
        // Create tombstone instead of hard delete (federation compliance)
        record.deleted = true;
        record.deletedAt = new Date().toISOString();
        record.deleteActivityId = activity.id;
        record.object = {
          type: 'Tombstone',
          id: objectId,
          formerType: record.objectType,
          deleted: record.deletedAt
        };

        writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
        console.log(`[SocialActivityService] Marked content as deleted: ${objectId}`);
        return;
      }
    } catch (err) {
      console.error(`[SocialActivityService] Failed to check file ${file}:`, err);
    }
  }

  console.log(`[SocialActivityService] Content not found for deletion: ${objectId}`);
}

/**
 * Get remote content for a local actor (timeline content)
 */
export function getRemoteContent(
  localActorHandle: string,
  options?: {
    limit?: number;
    includeDeleted?: boolean;
    since?: string;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  ensureSocialDirs();
  const contentPath = join(getRemoteContentDir(), localActorHandle);
  if (!existsSync(contentPath)) {
    return [];
  }

  const files = readdirSync(contentPath).filter((file: string) => file.endsWith('.json'));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  for (const file of files) {
    try {
      const filePath = join(contentPath, file);
      const fileContent = readFileSync(filePath, 'utf-8');
      const record = JSON.parse(fileContent);

      // Skip deleted unless requested
      if (record.deleted && !options?.includeDeleted) {
        continue;
      }

      // Filter by since date
      if (options?.since && record.published < options.since) {
        continue;
      }

      content.push(record);
    } catch (err) {
      console.error(`[SocialActivityService] Failed to load ${file}:`, err);
    }
  }

  // Sort by published date (newest first)
  content.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

  // Apply limit
  if (options?.limit && options.limit > 0) {
    return content.slice(0, options.limit);
  }

  return content;
}
