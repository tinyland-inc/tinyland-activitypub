/**
 * Content Federation Service
 * Handles conversion of content to ActivityPub format for federation
 *
 * NOTE: This is a simplified version of the original ContentFederationService
 * that does not depend on unified-content or commerce-schema types directly.
 * Those types are available via @tummycrypt/tinyland-content-types if needed.
 *
 * The consumer can pass a buildOffers callback to handle commerce integration.
 */

import type { Activity } from '../types/activitystreams.js';

// ============================================================================
// Constants
// ============================================================================

const ACTIVITY_STREAMS_CONTEXT = 'https://www.w3.org/ns/activitystreams';
const PUBLIC_ADDRESSING = 'https://www.w3.org/ns/activitystreams#Public';

// ============================================================================
// Types
// ============================================================================

/**
 * Flexible ActivityPub object for outbound federation
 */
export interface FederationObject {
  '@context'?: string | string[];
  id: string;
  type: string;
  name?: string;
  summary?: string;
  content?: string;
  published?: string;
  updated?: string;
  attributedTo?: string;
  to?: string[];
  cc?: string[];
  url?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachment?: Array<{ type: string; url?: string; name?: string; value?: string; mediaType?: string; [key: string]: any }>;
  tag?: Array<{ type: string; href: string; name: string }>;
  // Note-specific
  sensitive?: boolean;
  inReplyTo?: string;
  // Event-specific
  startTime?: string;
  endTime?: string;
  location?: { type: string; name?: string };
  // Video-specific
  duration?: string;
  width?: number;
  height?: number;
  // Person/Actor-specific
  preferredUsername?: string;
  inbox?: string;
  outbox?: string;
  following?: string;
  followers?: string;
  liked?: string;
  icon?: { type: string; url: string };
  image?: { type: string; url: string };
  discoverable?: boolean;
  manuallyApprovesFollowers?: boolean;
  // Tombstone
  formerType?: string;
  deleted?: string;
}

/**
 * Minimal content item for federation (subset of UnifiedContentItem)
 */
export interface FederableContent {
  slug: string;
  type: string;
  content: string;
  visibility: string;
  fediverseVisibility?: string;
  publishedAt: string;
  updatedAt?: string;
  authorHandle: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  frontmatter: Record<string, any>;
}

/**
 * Visibility levels for content
 */
export type ContentVisibility = 'public' | 'unlisted' | 'followers' | 'private' | 'direct';

/**
 * ActivityPub addressing
 */
export interface ActivityPubAddressing {
  to: string[];
  cc: string[];
}

// ============================================================================
// Addressing
// ============================================================================

/**
 * Get addressing for visibility level
 */
export function getAddressingForVisibility(
  visibility: string,
  actorUrl: string,
  followersUrl: string
): ActivityPubAddressing {
  switch (visibility) {
    case 'public':
      return {
        to: [PUBLIC_ADDRESSING],
        cc: [followersUrl]
      };
    case 'unlisted':
      return {
        to: [followersUrl],
        cc: [PUBLIC_ADDRESSING]
      };
    case 'followers':
      return {
        to: [followersUrl],
        cc: []
      };
    case 'private':
      return {
        to: [actorUrl],
        cc: []
      };
    case 'direct':
      return {
        to: [],
        cc: []
      };
    default:
      return {
        to: [PUBLIC_ADDRESSING],
        cc: [followersUrl]
      };
  }
}

// ============================================================================
// ActivityPub ID Generation
// ============================================================================

/**
 * Generate ActivityPub ID for content
 */
export function generateActivityPubId(
  content: FederableContent,
  baseUrl: string
): string {
  const base = baseUrl.replace(/\/$/, '');
  const typePathMap: Record<string, string> = {
    blog: 'blog',
    note: 'notes',
    product: 'products',
    event: 'events',
    program: 'programs',
    video: 'videos',
    profile: 'profiles',
    image: 'images',
    document: 'docs'
  };
  const typePath = typePathMap[content.type] || 'content';
  return `${base}/ap/content/${typePath}/${content.slug}`;
}

/**
 * Generate ActivityPub ID for an activity
 */
export function generateActivityId(
  content: FederableContent,
  activityType: string,
  baseUrl: string
): string {
  const base = baseUrl.replace(/\/$/, '');
  const timestamp = Date.now();
  return `${base}/ap/activities/${activityType.toLowerCase()}/${content.slug}-${timestamp}`;
}

// ============================================================================
// Content to ActivityPub Conversion
// ============================================================================

/**
 * Convert content to ActivityPub object
 */
export function contentToActivityPubObject(
  content: FederableContent,
  baseUrl: string,
  typeMapper?: (type: string) => string
): FederationObject {
  const base = baseUrl.replace(/\/$/, '');
  const apType = typeMapper ? typeMapper(content.type) : getDefaultActivityPubType(content.type);
  const id = generateActivityPubId(content, baseUrl);

  const actorUrl = `${base}/ap/users/${content.authorHandle}`;
  const followersUrl = `${actorUrl}/followers`;
  const addressing = getAddressingForVisibility(
    content.fediverseVisibility || content.visibility,
    actorUrl,
    followersUrl
  );

  const fm = content.frontmatter;

  const baseObject: FederationObject = {
    '@context': ACTIVITY_STREAMS_CONTEXT,
    id,
    type: apType,
    attributedTo: actorUrl,
    published: content.publishedAt,
    updated: content.updatedAt,
    url: `${base}/@${content.authorHandle}/${content.type}/${content.slug}`,
    to: addressing.to,
    cc: addressing.cc
  };

  // Add type-specific fields
  switch (content.type) {
    case 'blog':
      return {
        ...baseObject,
        type: 'Article',
        name: (fm.title as string) || content.slug,
        summary: (fm.excerpt as string) || (fm.description as string),
        content: content.content,
        attachment: fm.image ? [{ type: 'Image', url: fm.image as string }] : undefined,
        tag: buildTags(fm.tags as string[], fm.categories as string[])
      };

    case 'note':
      return {
        ...baseObject,
        type: 'Note',
        content: content.content || (fm.excerpt as string) || '',
        sensitive: (fm.sensitive as boolean) || false,
        summary: fm.spoilerText as string,
        inReplyTo: fm.inReplyTo as string,
        tag: buildTags(fm.hashtags as string[], fm.mentions as string[])
      };

    case 'product':
      return {
        ...baseObject,
        type: 'Page',
        name: (fm.name as string) || (fm.title as string) || content.slug,
        summary: (fm.excerpt as string) || (fm.description as string),
        content: content.content,
        attachment: fm.image ? [{ type: 'Image', url: fm.image as string }] : undefined,
        tag: buildTags(fm.tags as string[])
      };

    case 'event':
    case 'program':
      return {
        ...baseObject,
        type: 'Event',
        name: (fm.title as string) || content.slug,
        summary: (fm.excerpt as string) || (fm.description as string),
        content: content.content,
        startTime: (fm.startDateTime as string) || (fm.startDate as string) || (fm.date as string) || content.publishedAt,
        endTime: (fm.endDateTime as string) || (fm.endDate as string),
        location: fm.location
          ? typeof fm.location === 'object'
            ? { type: 'Place', name: (fm.location as Record<string, unknown>).name as string }
            : { type: 'Place', name: fm.location as string }
          : undefined,
        attachment: fm.image ? [{ type: 'Image', url: fm.image as string }] : undefined,
        tag: buildTags(fm.tags as string[], fm.categories as string[])
      };

    case 'video':
      return {
        ...baseObject,
        type: 'Video',
        name: (fm.title as string) || content.slug,
        summary: (fm.excerpt as string) || (fm.description as string),
        content: content.content,
        url: (fm.url as string) || (fm.embedUrl as string),
        duration: fm.duration as string,
        width: fm.width as number,
        height: fm.height as number,
        attachment: fm.image ? [{ type: 'Image', url: fm.image as string, name: 'thumbnail' }] : undefined,
        tag: buildTags(fm.tags as string[], fm.categories as string[])
      };

    case 'profile':
      return {
        ...baseObject,
        type: 'Person',
        id: `${base}/ap/users/${content.slug}`,
        preferredUsername: content.slug,
        name: (fm.name as string) || (fm.displayName as string) || content.slug,
        summary: (fm.bio as string) || content.content,
        inbox: `${base}/ap/users/${content.slug}/inbox`,
        outbox: `${base}/ap/users/${content.slug}/outbox`,
        following: `${base}/ap/users/${content.slug}/following`,
        followers: `${base}/ap/users/${content.slug}/followers`,
        liked: `${base}/ap/users/${content.slug}/liked`,
        url: `${base}/@${content.slug}`,
        icon: (fm.avatar || fm.image) ? { type: 'Image', url: (fm.avatar as string) || (fm.image as string) } : undefined,
        image: fm.coverImage ? { type: 'Image', url: fm.coverImage as string } : undefined,
        discoverable: true,
        manuallyApprovesFollowers: false
      };

    default:
      return {
        ...baseObject,
        name: (fm.title as string) || content.slug,
        summary: (fm.excerpt as string) || (fm.description as string),
        content: content.content
      };
  }
}

/**
 * Get default ActivityPub type for content type
 */
function getDefaultActivityPubType(type: string): string {
  const typeMap: Record<string, string> = {
    blog: 'Article',
    note: 'Note',
    product: 'Page',
    profile: 'Person',
    event: 'Event',
    program: 'Event',
    video: 'Video',
    image: 'Image',
    document: 'Document'
  };
  return typeMap[type] || 'Object';
}

/**
 * Build hashtag and mention tags for ActivityPub
 */
function buildTags(
  tags?: string[],
  additional?: string[]
): Array<{ type: string; href: string; name: string }> | undefined {
  const allTags: Array<{ type: string; href: string; name: string }> = [];

  if (tags && tags.length > 0) {
    for (const tag of tags) {
      const normalized = tag.startsWith('#') ? tag : `#${tag}`;
      allTags.push({
        type: 'Hashtag',
        href: `/tags/${encodeURIComponent(tag.replace(/^#/, ''))}`,
        name: normalized
      });
    }
  }

  if (additional && additional.length > 0) {
    for (const item of additional) {
      if (item.startsWith('@')) {
        allTags.push({
          type: 'Mention',
          href: `/users/${encodeURIComponent(item.replace(/^@/, ''))}`,
          name: item
        });
      } else {
        allTags.push({
          type: 'Hashtag',
          href: `/tags/${encodeURIComponent(item)}`,
          name: `#${item}`
        });
      }
    }
  }

  return allTags.length > 0 ? allTags : undefined;
}

// ============================================================================
// Activity Wrapping
// ============================================================================

/**
 * Wrap content in a Create activity
 */
export function wrapInCreateActivity(
  content: FederableContent,
  baseUrl: string
): Activity {
  const base = baseUrl.replace(/\/$/, '');
  const object = contentToActivityPubObject(content, baseUrl);
  const actorUrl = `${base}/ap/users/${content.authorHandle}`;

  return {
    '@context': ACTIVITY_STREAMS_CONTEXT,
    id: generateActivityId(content, 'Create', baseUrl),
    type: 'Create',
    actor: actorUrl,
    object,
    published: content.publishedAt,
    to: object.to,
    cc: object.cc
  } as Activity;
}

/**
 * Wrap content update in an Update activity
 */
export function wrapInUpdateActivity(
  content: FederableContent,
  baseUrl: string
): Activity {
  const base = baseUrl.replace(/\/$/, '');
  const object = contentToActivityPubObject(content, baseUrl);
  const actorUrl = `${base}/ap/users/${content.authorHandle}`;

  return {
    '@context': ACTIVITY_STREAMS_CONTEXT,
    id: generateActivityId(content, 'Update', baseUrl),
    type: 'Update',
    actor: actorUrl,
    object,
    published: content.updatedAt || content.publishedAt,
    to: object.to,
    cc: object.cc
  } as Activity;
}

/**
 * Create a Delete activity for content
 */
export function createDeleteActivity(
  content: FederableContent,
  baseUrl: string
): Activity {
  const base = baseUrl.replace(/\/$/, '');
  const objectId = generateActivityPubId(content, baseUrl);
  const actorUrl = `${base}/ap/users/${content.authorHandle}`;
  const followersUrl = `${actorUrl}/followers`;

  return {
    '@context': ACTIVITY_STREAMS_CONTEXT,
    id: generateActivityId(content, 'Delete', baseUrl),
    type: 'Delete',
    actor: actorUrl,
    object: {
      id: objectId,
      type: 'Tombstone',
      formerType: getDefaultActivityPubType(content.type),
      deleted: new Date().toISOString()
    },
    to: [PUBLIC_ADDRESSING],
    cc: [followersUrl]
  } as Activity;
}

// ============================================================================
// Federation Helpers
// ============================================================================

/**
 * Check if content should be federated
 */
export function shouldFederateContent(content: FederableContent): boolean {
  const visibility = content.fediverseVisibility || content.visibility;

  if (visibility === 'private' || visibility === 'direct') {
    return false;
  }

  const fm = content.frontmatter;
  if (fm.federate === false || fm.noFederate === true) {
    return false;
  }

  if (content.type === 'profile') {
    return true;
  }

  if (!content.publishedAt) {
    return false;
  }

  return true;
}

/**
 * Get federation visibility level
 */
export function getFederationVisibility(content: FederableContent): ContentVisibility {
  return (content.fediverseVisibility || content.visibility) as ContentVisibility;
}

/**
 * Check if content is publicly discoverable
 */
export function isPubliclyDiscoverable(content: FederableContent): boolean {
  const visibility = getFederationVisibility(content);
  return visibility === 'public';
}

/**
 * Get ActivityPub addressing for content
 */
export function getContentAddressing(
  content: FederableContent,
  baseUrl: string
): ActivityPubAddressing {
  const base = baseUrl.replace(/\/$/, '');
  const actorUrl = `${base}/ap/users/${content.authorHandle}`;
  const followersUrl = `${actorUrl}/followers`;

  return getAddressingForVisibility(
    getFederationVisibility(content),
    actorUrl,
    followersUrl
  );
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Convert multiple content items to ActivityPub objects
 */
export function batchContentToActivityPub(
  items: FederableContent[],
  baseUrl: string
): FederationObject[] {
  return items
    .filter(shouldFederateContent)
    .map(item => contentToActivityPubObject(item, baseUrl));
}

/**
 * Wrap multiple content items in Create activities
 */
export function batchWrapInCreateActivities(
  items: FederableContent[],
  baseUrl: string
): Activity[] {
  return items
    .filter(shouldFederateContent)
    .map(item => wrapInCreateActivity(item, baseUrl));
}
