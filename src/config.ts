/**
 * ActivityPub Configuration
 * Centralized configuration for ActivityPub implementation
 * Uses config injection pattern instead of process.env
 */

import { join } from 'path';

// ============================================================================
// Configuration Interface
// ============================================================================

export interface ActivityPubConfig {
  siteBaseUrl: string;
  federationEnabled: boolean;
  defaultVisibility: 'public' | 'unlisted' | 'followers' | 'private';
  autoApproveFollows: boolean;
  maxDeliveryRetries: number;
  federationTimeout: number;
  signatureVerificationEnabled: boolean;
  actorKeyCacheTtl: number;
  maxContentLength: number;
  maxTags: number;
  maxMentions: number;
  maxAttachments: number;
  maxUploadSize: number;
  defaultPageSize: number;
  maxPageSize: number;
  activitypubDir: string;
  /** Software version for NodeInfo */
  softwareVersion?: string;
  /** Callback to resolve a user by handle */
  resolveUser?: (handle: string) => Promise<{
    handle: string;
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
  } | null>;
}

// ============================================================================
// Defaults
// ============================================================================

const defaults: ActivityPubConfig = {
  siteBaseUrl: 'https://tinyland.dev',
  federationEnabled: true,
  defaultVisibility: 'public',
  autoApproveFollows: false,
  maxDeliveryRetries: 3,
  federationTimeout: 10000,
  signatureVerificationEnabled: true,
  actorKeyCacheTtl: 3600,
  maxContentLength: 500000,
  maxTags: 50,
  maxMentions: 50,
  maxAttachments: 10,
  maxUploadSize: 10485760, // 10MB
  defaultPageSize: 20,
  maxPageSize: 100,
  activitypubDir: '.activitypub',
};

// ============================================================================
// Config Injection
// ============================================================================

let _config: ActivityPubConfig | null = null;

/**
 * Configure ActivityPub with custom settings
 */
export function configureActivityPub(config: Partial<ActivityPubConfig>): void {
  _config = { ...defaults, ...config };
}

/**
 * Get current ActivityPub configuration
 */
export function getActivityPubConfig(): ActivityPubConfig {
  if (!_config) _config = { ...defaults };
  return _config;
}

/**
 * Reset configuration to defaults (useful for testing)
 */
export function resetActivityPubConfig(): void {
  _config = null;
}

// ============================================================================
// Derived Constants (computed from config)
// ============================================================================

/**
 * Get site base URL (without trailing slash)
 */
export function getSiteBaseUrl(): string {
  return getActivityPubConfig().siteBaseUrl.replace(/\/$/, '');
}

/**
 * Get instance domain (extracted from base URL)
 */
export function getInstanceDomain(): string {
  const config = getActivityPubConfig();
  try {
    return new URL(config.siteBaseUrl).hostname;
  } catch {
    return 'tinyland.dev';
  }
}

/**
 * Get the resolved ActivityPub data directory
 */
export function getActivityPubDir(): string {
  const config = getActivityPubConfig();
  const dir = config.activitypubDir;
  return dir.startsWith('/') ? dir : join(process.cwd(), dir);
}

/**
 * Get actors directory
 */
export function getActorsDir(): string {
  return join(getActivityPubDir(), 'actors');
}

/**
 * Get followers directory
 */
export function getFollowersDir(): string {
  return join(getActivityPubDir(), 'followers');
}

/**
 * Get following directory
 */
export function getFollowingDir(): string {
  return join(getActivityPubDir(), 'following');
}

/**
 * Get likes directory
 */
export function getLikesDir(): string {
  return join(getActivityPubDir(), 'likes');
}

/**
 * Get boosts directory
 */
export function getBoostsDir(): string {
  return join(getActivityPubDir(), 'boosts');
}

/**
 * Get notifications directory
 */
export function getNotificationsDir(): string {
  return join(getActivityPubDir(), 'notifications');
}

/**
 * Get delivery queue directory
 */
export function getDeliveryQueueDir(): string {
  return join(getActivityPubDir(), 'delivery-queue');
}

/**
 * Get remote actors cache directory
 */
export function getRemoteActorsCacheDir(): string {
  return join(getActivityPubDir(), 'remote-actors');
}

// ============================================================================
// Content Type Configuration
// ============================================================================

/**
 * Map internal content types to ActivityPub types
 */
export const CONTENT_TYPE_MAPPING: Record<string, string> = {
  blog: 'Article',
  product: 'Page',
  profile: 'Article',
  event: 'Event',
  comment: 'Note',
  image: 'Image',
  video: 'Video',
  audio: 'Audio'
};

/**
 * ActivityPub content types that support replies
 */
export const REPLYABLE_TYPES = new Set([
  'Note',
  'Article',
  'Page',
  'Question'
]);

/**
 * ActivityPub content types that support likes
 */
export const LIKABLE_TYPES = new Set([
  'Note',
  'Article',
  'Page',
  'Image',
  'Video',
  'Audio',
  'Event'
]);

/**
 * ActivityPub content types that support boosts (announces)
 */
export const BOOSTABLE_TYPES = new Set([
  'Note',
  'Article',
  'Image',
  'Video',
  'Audio'
]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get ActivityPub actor URI for a handle
 */
export function getActorUri(handle: string): string {
  return `${getSiteBaseUrl()}/@${handle}`;
}

/**
 * Get ActivityPub inbox URI for a handle
 */
export function getInboxUri(handle: string): string {
  return `${getActorUri(handle)}/inbox`;
}

/**
 * Get ActivityPub outbox URI for a handle
 */
export function getOutboxUri(handle: string): string {
  return `${getActorUri(handle)}/outbox`;
}

/**
 * Get ActivityPub followers URI for a handle
 */
export function getFollowersUri(handle: string): string {
  return `${getActorUri(handle)}/followers`;
}

/**
 * Get ActivityPub following URI for a handle
 */
export function getFollowingUri(handle: string): string {
  return `${getActorUri(handle)}/following`;
}

/**
 * Get ActivityPub liked URI for a handle
 */
export function getLikedUri(handle: string): string {
  return `${getActorUri(handle)}/liked`;
}

/**
 * Get WebFinger resource string for a handle
 */
export function getWebFingerResource(handle: string): string {
  return `acct:${handle}@${getInstanceDomain()}`;
}

/**
 * Check if a URI belongs to this instance
 */
export function isLocalUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.hostname === getInstanceDomain();
  } catch {
    return false;
  }
}

/**
 * Extract handle from local URI
 */
export function extractHandleFromUri(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.hostname !== getInstanceDomain()) {
      return null;
    }

    // Extract handle from /@handle pattern
    const match = url.pathname.match(/^\/@([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get content type for internal content
 */
export function getInternalContentType(internalType: string): string {
  return CONTENT_TYPE_MAPPING[internalType] || 'Note';
}

/**
 * Check if type supports replies
 */
export function isReplyable(type: string): boolean {
  return REPLYABLE_TYPES.has(type);
}

/**
 * Check if type supports likes
 */
export function isLikable(type: string): boolean {
  return LIKABLE_TYPES.has(type);
}

/**
 * Check if type supports boosts
 */
export function isBoostable(type: string): boolean {
  return BOOSTABLE_TYPES.has(type);
}
