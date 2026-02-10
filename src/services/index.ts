/**
 * Services barrel export
 */

// Actor Service
export {
  type ActorUser,
  type ActorProfile,
  type StoredActor,
  generateKeyPair,
  createActorFromUser,
  getActorByHandle,
  getActorPrivateKey,
  deleteActor
} from './ActorService.js';

// WebFinger Service
export {
  type WebFingerResource,
  type WebFingerLink,
  parseResource,
  getWebFingerForResource,
  webFingerFromActor,
  validateWebFingerQuery
} from './WebFingerService.js';

// NodeInfo Service
export {
  type NodeInfo,
  type NodeInfoLinks,
  getUserCount,
  getPublicPostCount,
  getLocalCommentCount,
  getNodeInfoLinks,
  getNodeInfo,
  getNodeInfo20
} from './NodeInfoService.js';

// HTTP Signature Service
export {
  type SignatureHeader,
  type PublicKeyInfo,
  generateDigest,
  verifyDigest,
  parseSignatureHeader,
  getPublicKey,
  verifyHttpSignature,
  signRequest,
  createSignedRequest,
  cleanupExpiredKeys,
  clearKeyCache
} from './HttpSignatureService.js';

// Content Object Service
export {
  createObject,
  convertBlogPostToArticle,
  convertNoteToNoteObject,
  convertProductToObject,
  convertProfileToObject,
  convertImageToImageObject,
  convertVideoToVideoObject,
  convertDocumentToDocumentObject
} from './ContentObjectService.js';

// Featured Service
export {
  type FeaturedItem,
  type FrontmatterParser,
  setFrontmatterParser,
  getFeaturedPosts,
  featuredItemToActivity,
  getFeaturedCollection
} from './FeaturedService.js';

// Followers Service
export {
  type Follower,
  type Following,
  type FollowRelationship,
  addFollower,
  removeFollower,
  getFollowers,
  getFollowerCount,
  isFollowing,
  addFollowing,
  removeFollowing,
  getFollowing,
  getFollowingCount,
  getFollowerUris,
  getFollowingUris,
  acceptFollowRequest,
  rejectFollowRequest,
  getPendingFollowRequests,
  extractHandleFromUri,
  buildFollowerFromActivity
} from './FollowersService.js';

// Follow Service
export {
  type RemoteActor,
  type FollowStatus,
  followActor,
  unfollowActor,
  isFollowingActor,
  acceptFollow,
  rejectFollow,
  fetchRemoteActor,
  getFollowedActors
} from './FollowService.js';

// Announce Service
export {
  type OutgoingAnnounce,
  announceObject,
  unannounceObject,
  getOutgoingAnnounces,
  getOutgoingAnnounceCount,
  hasAnnounced
} from './AnnounceService.js';

// Liked Service
export {
  type OutgoingLike,
  likeObject,
  unlikeObject,
  getOutgoingLikes,
  getOutgoingLikeCount,
  hasLiked
} from './LikedService.js';

// Group Actor Service
export {
  type StoredGroup,
  type CreateGroupInput,
  createGroup,
  getGroupByHandle,
  listGroups,
  updateGroup,
  deleteGroup,
  storedGroupToActivityPub,
  getGroupPrivateKey
} from './GroupActorService.js';

// Activity Delivery Service
export {
  type DeliveryTask,
  type DeliveryStats,
  queueForDelivery,
  getDeliveryTask,
  getDeliveryStats,
  processDeliveryQueue,
  cleanupOldTasks
} from './ActivityDeliveryService.js';

// Social Activity Service
export {
  type LikeRecord,
  type AnnounceRecord,
  type Notification,
  handleFollowActivity,
  acceptFollow as acceptFollowActivity,
  rejectFollow as rejectFollowActivity,
  handleAcceptActivity,
  handleRejectActivity,
  handleUndoActivity,
  handleLikeActivity,
  getLikesForObject,
  getLikeCount,
  handleAnnounceActivity,
  getAnnouncesForObject,
  getAnnounceCount,
  createNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  handleCreateActivity,
  handleUpdateActivity,
  handleDeleteActivity,
  getRemoteContent
} from './SocialActivityService.js';
