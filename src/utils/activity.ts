/**
 * ActivityPub Activity Utilities
 * Helper functions for ActivityPub activities
 */

import type { Activity } from '../types/activitystreams.js';
import { getActorUri, isLocalUri } from '../config.js';

/** Valid ActivityPub activity types */
export type ActivityType =
  | 'Create' | 'Update' | 'Delete' | 'Add' | 'Remove' | 'Move'
  | 'Follow' | 'Like' | 'Announce' | 'Undo' | 'Accept' | 'Reject'
  | 'Block' | 'Flag';

const VALID_ACTIVITY_TYPES: readonly string[] = [
  'Create', 'Update', 'Delete', 'Add', 'Remove', 'Move',
  'Follow', 'Like', 'Announce', 'Undo', 'Accept', 'Reject',
  'Block', 'Flag'
];

// ============================================================================
// Activity Type Guards
// ============================================================================

/**
 * Check if a string is a valid ActivityPub activity type name,
 * or check if an Activity object is of a specific type.
 *
 * Single argument: validates a type name string
 * Two arguments: type guard for Activity objects
 */
export function isActivityType(typeOrActivity: string): boolean;
export function isActivityType<T extends Activity>(activity: Activity, type: ActivityType): activity is T;
export function isActivityType(
  activityOrType: Activity | string,
  type?: ActivityType
): boolean {
  if (type !== undefined) {
    // Two-arg form: type guard
    return (activityOrType as Activity).type === type;
  }
  // Single-arg form: validate type name
  return VALID_ACTIVITY_TYPES.includes(activityOrType as string);
}

/**
 * Normalize addressing field to string array
 */
function toStringArray(field: string[] | { href: string } | undefined): string[] {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  return [field.href];
}

/**
 * Check if an activity is directed at local actor
 */
export function isActivityForLocalActor(activity: Activity, actorUri: string): boolean {
  const recipients = [
    ...toStringArray(activity.to),
    ...toStringArray(activity.cc),
    ...toStringArray(activity.bto),
    ...toStringArray(activity.bcc)
  ];

  return recipients.some(recipient => {
    if (typeof recipient !== 'string') {
      return false;
    }

    return recipient === actorUri || recipient === getActorUri(actorUri);
  });
}

/**
 * Check if an activity is public
 */
export function isPublicActivity(activity: Activity): boolean {
  const recipients = [
    ...toStringArray(activity.to),
    ...toStringArray(activity.cc),
    ...toStringArray(activity.bto),
    ...toStringArray(activity.bcc)
  ];

  return recipients.includes('https://www.w3.org/ns/activitystreams#Public');
}

/**
 * Check if actor is local
 */
export function isLocalActor(actorUri: string): boolean {
  return isLocalUri(actorUri);
}

/**
 * Extract handle from actor URI
 */
export function getActorHandle(actorUri: string): string | null {
  if (isLocalUri(actorUri)) {
    const url = new URL(actorUri);
    const match = url.pathname.match(/^\/@([^/]+)$/);
    return match ? match[1] : null;
  }

  return null;
}

/**
 * Build Activity URI
 */
export function buildActivityUri(
  actorHandle: string,
  _activityType: string,
  objectId: string
): string {
  const actorUriValue = getActorUri(actorHandle);
  return `${actorUriValue}/activities/${objectId}`;
}

/**
 * Validate ActivityPub activity
 */
export function validateActivity(activity: Activity): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!activity.id) {
    errors.push('Missing activity ID');
  }

  if (!activity.type) {
    errors.push('Missing activity type');
  }

  if (!activity.actor) {
    errors.push('Missing activity actor');
  }

  if (!activity.object) {
    errors.push('Missing activity object');
  }

  // Check addressing
  if (!activity.to && !activity.cc) {
    errors.push('Missing activity addressing (to/cc)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Extract object ID from activity
 */
export function extractObjectId(activity: Activity): string | null {
  const object = activity.object;

  if (typeof object === 'string') {
    return object;
  }

  if (object && typeof object === 'object' && 'id' in object && (object as { id: string }).id) {
    return (object as { id: string }).id;
  }

  return null;
}

/**
 * Extract actor ID from activity
 */
export function extractActorId(activity: Activity): string {
  const actor = activity.actor;

  if (typeof actor === 'string') {
    return actor;
  }

  if (actor && typeof actor === 'object' && 'id' in actor && (actor as { id: string }).id) {
    return (actor as { id: string }).id;
  }

  throw new Error('Invalid actor in activity');
}

/**
 * Build addressing for activity
 */
export function buildAddressing(params: {
  public?: boolean;
  followers?: boolean;
  mentions?: string[];
}): { to: string[]; cc: string[] } {
  const to: string[] = [];
  const cc: string[] = [];

  // Public addressing
  if (params.public) {
    to.push('https://www.w3.org/ns/activitystreams#Public');
  }

  // Followers addressing
  if (params.followers) {
    cc.push('https://www.w3.org/ns/activitystreams#Public');
  }

  // Mentions
  if (params.mentions) {
    cc.push(...params.mentions);
  }

  return { to, cc };
}

/**
 * Check if activity needs delivery
 */
export function needsDelivery(activity: Activity): boolean {
  const toArr = toStringArray(activity.to);
  const ccArr = toStringArray(activity.cc);

  // Don't deliver if activity is only to local actor
  const hasPublicRecipients = toArr.includes('https://www.w3.org/ns/activitystreams#Public') ||
                            ccArr.includes('https://www.w3.org/ns/activitystreams#Public');

  // Check for non-local recipients
  const hasRemoteRecipients = [
    ...toArr,
    ...ccArr
  ].some(recipient => {
    if (typeof recipient !== 'string') {
      return false;
    }
    return !isLocalUri(recipient);
  });

  return hasPublicRecipients || hasRemoteRecipients;
}
