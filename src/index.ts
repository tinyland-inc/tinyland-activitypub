/**
 * @tinyland-inc/tinyland-activitypub
 *
 * ActivityPub federation implementation for Tinyland.
 * Provides W3C ActivityPub protocol support, HTTP Signatures, WebFinger,
 * and NodeInfo for federated social networking.
 */

// Configuration
export {
  type ActivityPubConfig,
  configureActivityPub,
  getActivityPubConfig,
  resetActivityPubConfig,
  getSiteBaseUrl,
  getInstanceDomain,
  getActivityPubDir,
  getActorsDir,
  getFollowersDir,
  getFollowingDir,
  getLikesDir,
  getBoostsDir,
  getNotificationsDir,
  getDeliveryQueueDir,
  getRemoteActorsCacheDir,
  CONTENT_TYPE_MAPPING,
  REPLYABLE_TYPES,
  LIKABLE_TYPES,
  BOOSTABLE_TYPES,
  getActorUri,
  getInboxUri,
  getOutboxUri,
  getFollowersUri,
  getFollowingUri,
  getLikedUri,
  getWebFingerResource,
  isLocalUri,
  extractHandleFromUri,
  getInternalContentType,
  isReplyable,
  isLikable,
  isBoostable
} from './config.js';

// Errors
export {
  FederationError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  DeliveryError,
  SignatureVerificationError
} from './errors.js';

// Re-export submodules
export * from './types/index.js';
export * from './utils/index.js';
