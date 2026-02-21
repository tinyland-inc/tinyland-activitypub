/**
 * Follow Service
 * Manages outgoing follow requests (actors this user wants to follow)
 */

import crypto from 'crypto';
import { getActorUri, getActivityPubConfig } from '../config.js';
import { queueForDelivery } from './ActivityDeliveryService.js';
import { addFollowing, removeFollowing, getFollowing } from './FollowersService.js';
import type { Follow, Undo } from '../types/activitystreams.js';
import type { Following } from './FollowersService.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface RemoteActor {
  id: string;
  preferredUsername: string;
  name?: string;
  icon?: { url: string };
  inbox: string;
  type: string;
}

export interface FollowStatus {
  following: boolean;
  status: 'pending' | 'accepted' | null;
}

// ============================================================================
// Follow Management
// ============================================================================

/**
 * Send a follow request to a remote actor
 * @param localHandle - Local user handle (e.g., 'alice')
 * @param remoteActorUri - Remote actor URI (e.g., 'https://mastodon.social/@bob')
 * @returns Activity ID and initial status
 */
export async function followActor(
  localHandle: string,
  remoteActorUri: string
): Promise<{ activityId: string; status: 'pending' | 'accepted' }> {
  // Fetch remote actor to get their inbox
  const remoteActor = await fetchRemoteActor(remoteActorUri);

  if (!remoteActor) {
    throw new Error(`Could not fetch remote actor: ${remoteActorUri}`);
  }

  // Create Follow activity
  const activityId = `${getActorUri(localHandle)}/activities/${crypto.randomUUID()}`;
  const followActivity: Follow = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: activityId,
    type: 'Follow',
    actor: getActorUri(localHandle),
    object: remoteActorUri,
    published: new Date().toISOString()
  };

  // Add to following list with pending status
  const following: Following = {
    actorUri: remoteActorUri,
    handle: remoteActor.preferredUsername,
    domain: new URL(remoteActorUri).hostname,
    displayName: remoteActor.name,
    avatarUrl: remoteActor.icon?.url,
    followingSince: new Date().toISOString(),
    status: 'pending'
  };

  addFollowing(localHandle, following);

  // Queue for delivery to remote actor's inbox
  await queueForDelivery(followActivity, [remoteActor.inbox], localHandle);

  return {
    activityId,
    status: 'pending'
  };
}

/**
 * Unfollow a remote actor
 * @param localHandle - Local user handle
 * @param remoteActorUri - Remote actor URI to unfollow
 */
export async function unfollowActor(
  localHandle: string,
  remoteActorUri: string
): Promise<void> {
  // Check if we're following this actor
  const followingList = getFollowing(localHandle);
  const existing = followingList.find(f => f.actorUri === remoteActorUri);

  if (!existing) {
    throw new Error(`Not following actor: ${remoteActorUri}`);
  }

  // Fetch remote actor to get their inbox
  const remoteActor = await fetchRemoteActor(remoteActorUri);

  if (!remoteActor) {
    // Still remove from local following list even if remote actor is unreachable
    removeFollowing(localHandle, remoteActorUri);
    return;
  }

  // Create Undo Follow activity
  const originalFollowId = `${getActorUri(localHandle)}/activities/${crypto.randomUUID()}`;
  const undoActivityId = `${getActorUri(localHandle)}/activities/${crypto.randomUUID()}`;

  const undoActivity: Undo = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: undoActivityId,
    type: 'Undo',
    actor: getActorUri(localHandle),
    object: {
      id: originalFollowId,
      type: 'Follow',
      actor: getActorUri(localHandle),
      object: remoteActorUri
    },
    published: new Date().toISOString()
  };

  // Remove from following list
  removeFollowing(localHandle, remoteActorUri);

  // Queue for delivery to remote actor's inbox
  await queueForDelivery(undoActivity, [remoteActor.inbox], localHandle);
}

/**
 * Check if local actor is following remote actor
 * @param localHandle - Local user handle
 * @param remoteActorUri - Remote actor URI
 * @returns Follow status with current state
 */
export function isFollowingActor(localHandle: string, remoteActorUri: string): FollowStatus {
  const followingList = getFollowing(localHandle);
  const existing = followingList.find(f => f.actorUri === remoteActorUri);

  if (!existing) {
    return {
      following: false,
      status: null
    };
  }

  return {
    following: true,
    status: existing.status
  };
}

/**
 * Accept a follow request (update status from pending to accepted)
 * Called when we receive an Accept activity from remote actor
 * @param localHandle - Local user handle
 * @param remoteActorUri - Remote actor URI that accepted the follow
 * @returns true if follow was found and updated, false otherwise
 */
export function acceptFollow(localHandle: string, remoteActorUri: string): boolean {
  const followingList = getFollowing(localHandle);
  const existing = followingList.find(f => f.actorUri === remoteActorUri);

  if (!existing) {
    console.warn(`[FollowService] Cannot accept follow - not in following list: ${remoteActorUri}`);
    return false;
  }

  if (existing.status === 'accepted') {
    console.log(`[FollowService] Follow already accepted: ${remoteActorUri}`);
    return true;
  }

  // Update status to accepted
  existing.status = 'accepted';
  addFollowing(localHandle, existing);
  console.log(`[FollowService] Follow accepted: ${remoteActorUri}`);
  return true;
}

/**
 * Reject a follow request (remove from following list)
 * Called when we receive a Reject activity from remote actor
 * @param localHandle - Local user handle
 * @param remoteActorUri - Remote actor URI that rejected the follow
 * @returns true if follow was found and removed, false otherwise
 */
export function rejectFollow(localHandle: string, remoteActorUri: string): boolean {
  const followingList = getFollowing(localHandle);
  const existing = followingList.find(f => f.actorUri === remoteActorUri);

  if (!existing) {
    console.warn(`[FollowService] Cannot reject follow - not in following list: ${remoteActorUri}`);
    return false;
  }

  // Remove from following list (rejected follows are deleted, not kept with status)
  removeFollowing(localHandle, remoteActorUri);
  console.log(`[FollowService] Follow rejected and removed: ${remoteActorUri}`);
  return true;
}

// ============================================================================
// Remote Actor Fetching
// ============================================================================

/**
 * Fetch remote actor info via ActivityPub
 * @param actorUri - Remote actor URI
 * @returns Actor data or null if fetch fails
 */
export async function fetchRemoteActor(actorUri: string): Promise<RemoteActor | null> {
  const config = getActivityPubConfig();

  try {
    const response = await fetch(actorUri, {
      headers: {
        'Accept': 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      },
      signal: AbortSignal.timeout(config.federationTimeout)
    });

    if (!response.ok) {
      console.error(`[FollowService] Failed to fetch actor ${actorUri}: HTTP ${response.status}`);
      return null;
    }

    const actor = await response.json();

    // Validate required fields
    if (!actor.id || !actor.inbox || !actor.preferredUsername) {
      console.error(`[FollowService] Invalid actor data from ${actorUri}:`, actor);
      return null;
    }

    return {
      id: actor.id,
      preferredUsername: actor.preferredUsername,
      name: actor.name,
      icon: actor.icon,
      inbox: actor.inbox,
      type: actor.type
    };
  } catch (error) {
    console.error(`[FollowService] Error fetching remote actor ${actorUri}:`, error);
    return null;
  }
}

/**
 * Get all actors followed by local user
 * @param localHandle - Local user handle
 * @returns List of followed actors
 */
export function getFollowedActors(localHandle: string): Following[] {
  return getFollowing(localHandle);
}

/**
 * Get count of actors followed by local user (re-export with FollowService naming)
 * @param localHandle - Local user handle
 * @param status - Filter by status (optional)
 * @returns Count of followed actors
 */
export { getFollowingCount } from './FollowersService.js';
