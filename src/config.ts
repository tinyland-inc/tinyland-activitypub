





import { join } from 'path';





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
  
  softwareVersion?: string;
  
  resolveUser?: (handle: string) => Promise<{
    handle: string;
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
  } | null>;
}





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
  maxUploadSize: 10485760, 
  defaultPageSize: 20,
  maxPageSize: 100,
  activitypubDir: '.activitypub',
};





let _config: ActivityPubConfig | null = null;




export function configureActivityPub(config: Partial<ActivityPubConfig>): void {
  _config = { ...defaults, ...config };
}




export function getActivityPubConfig(): ActivityPubConfig {
  if (!_config) _config = { ...defaults };
  return _config;
}




export function resetActivityPubConfig(): void {
  _config = null;
}








export function getSiteBaseUrl(): string {
  return getActivityPubConfig().siteBaseUrl.replace(/\/$/, '');
}




export function getInstanceDomain(): string {
  const config = getActivityPubConfig();
  try {
    return new URL(config.siteBaseUrl).hostname;
  } catch {
    return 'tinyland.dev';
  }
}




export function getActivityPubDir(): string {
  const config = getActivityPubConfig();
  const dir = config.activitypubDir;
  return dir.startsWith('/') ? dir : join(process.cwd(), dir);
}




export function getActorsDir(): string {
  return join(getActivityPubDir(), 'actors');
}




export function getFollowersDir(): string {
  return join(getActivityPubDir(), 'followers');
}




export function getFollowingDir(): string {
  return join(getActivityPubDir(), 'following');
}




export function getLikesDir(): string {
  return join(getActivityPubDir(), 'likes');
}




export function getBoostsDir(): string {
  return join(getActivityPubDir(), 'boosts');
}




export function getNotificationsDir(): string {
  return join(getActivityPubDir(), 'notifications');
}




export function getDeliveryQueueDir(): string {
  return join(getActivityPubDir(), 'delivery-queue');
}




export function getRemoteActorsCacheDir(): string {
  return join(getActivityPubDir(), 'remote-actors');
}








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




export const REPLYABLE_TYPES = new Set([
  'Note',
  'Article',
  'Page',
  'Question'
]);




export const LIKABLE_TYPES = new Set([
  'Note',
  'Article',
  'Page',
  'Image',
  'Video',
  'Audio',
  'Event'
]);




export const BOOSTABLE_TYPES = new Set([
  'Note',
  'Article',
  'Image',
  'Video',
  'Audio'
]);








export function getActorUri(handle: string): string {
  return `${getSiteBaseUrl()}/@${handle}`;
}




export function getInboxUri(handle: string): string {
  return `${getActorUri(handle)}/inbox`;
}




export function getOutboxUri(handle: string): string {
  return `${getActorUri(handle)}/outbox`;
}




export function getFollowersUri(handle: string): string {
  return `${getActorUri(handle)}/followers`;
}




export function getFollowingUri(handle: string): string {
  return `${getActorUri(handle)}/following`;
}




export function getLikedUri(handle: string): string {
  return `${getActorUri(handle)}/liked`;
}




export function getWebFingerResource(handle: string): string {
  return `acct:${handle}@${getInstanceDomain()}`;
}




export function isLocalUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.hostname === getInstanceDomain();
  } catch {
    return false;
  }
}




export function extractHandleFromUri(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.hostname !== getInstanceDomain()) {
      return null;
    }

    
    const match = url.pathname.match(/^\/@([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}




export function getInternalContentType(internalType: string): string {
  return CONTENT_TYPE_MAPPING[internalType] || 'Note';
}




export function isReplyable(type: string): boolean {
  return REPLYABLE_TYPES.has(type);
}




export function isLikable(type: string): boolean {
  return LIKABLE_TYPES.has(type);
}




export function isBoostable(type: string): boolean {
  return BOOSTABLE_TYPES.has(type);
}
