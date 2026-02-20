/**
 * Utils exports for @tummycrypt/tinyland-activitypub
 */

// Mention and hashtag parsing
export {
  parseMentions,
  buildMentionUri,
  linkifyMentions,
  parseHashtags,
  buildHashtagUri,
  linkifyHashtags,
  parseContent,
  extractActorUrisFromMentions,
  buildMentionAddressing,
  type ParsedMention,
  type ParsedHashtag,
  type ParsedContent
} from './mentions.js';

// Activity utilities
export {
  isActivityType,
  isActivityForLocalActor,
  isPublicActivity,
  isLocalActor,
  getActorHandle,
  buildActivityUri,
  validateActivity,
  extractObjectId,
  extractActorId,
  buildAddressing,
  needsDelivery,
  type ActivityType
} from './activity.js';
