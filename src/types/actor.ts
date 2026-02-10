/**
 * ActivityPub Actor Type Definitions
 * Maps internal types to ActivityPub Actor objects
 */

// ============================================================================
// Actor Types - W3C ActivityPub Core Types
// ============================================================================

/**
 * Image object for avatars/banners
 */
export interface ActorImage {
  type: 'Image';
  url: string;
  mediaType?: string;
  width?: number;
  height?: number;
}

/**
 * Profile field value (Mastodon extension using Schema.org)
 */
export interface ActorPropertyValue {
  type: 'PropertyValue';
  name: string;
  value: string; // Can include HTML for links
}

/**
 * Public Key for signature verification
 */
export interface ActorPublicKey {
  id: string; // URI to public key
  owner: string; // Actor URI
  publicKeyPem: string; // PEM-encoded public key
}

/**
 * ActivityPub Actor (base interface for all actor types)
 * Any object with an inbox and outbox can function as an actor
 */
export interface Actor {
  // Required ActivityPub properties
  id: string; // URI (e.g., https://tinyland.dev/@alice)
  type: 'Person' | 'Group' | 'Organization' | 'Application' | 'Service';
  inbox: string; // URI to inbox endpoint
  outbox: string; // URI to outbox endpoint

  // Optional but recommended
  following: string; // URI to following collection
  followers: string; // URI to followers collection
  liked: string; // URI to liked objects collection
  featured?: string; // URI to pinned posts collection (Mastodon extension)
  featuredTags?: string; // URI to featured hashtags collection

  // Actor profile properties
  preferredUsername: string; // Handle (e.g., alice)
  name: string; // Display name
  summary?: string; // Profile bio (HTML)
  icon?: ActorImage; // Profile avatar
  image?: ActorImage; // Profile banner/header

  // Discovery properties
  discoverable?: boolean; // Visible in search
  indexable?: boolean; // Indexed by search engines

  // Privacy settings
  manuallyApprovesFollowers?: boolean; // Requires manual approval
  suspended?: boolean; // Account suspended status
  memorial?: boolean; // Memorial account

  // Profile fields (Mastodon extension)
  attachment?: ActorPropertyValue[]; // Profile metadata fields

  // Authentication
  publicKey: ActorPublicKey; // For HTTP Signature verification

  // Timestamps
  published: string; // ISO 8601
  updated?: string; // ISO 8601

  // URL to web profile
  url?: string;

  // Endpoints for federation (Mastodon extension)
  endpoints?: {
    sharedInbox?: string;
  };

  // JSON-LD context
  '@context'?: string | (string | Record<string, string>)[];
}

// ============================================================================
// Internal Actor Mapping Types
// ============================================================================

/**
 * Internal user representation that maps to ActivityPub Actor
 */
export interface InternalActor {
  id: string;
  handle: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  website?: string;
  location?: string;
  pronouns?: string;
  email?: string;

  // Social links (Mastodon, Twitter, GitHub, etc.)
  mastodon?: string;
  twitter?: string;
  github?: string;
  linkedin?: string;
  instagram?: string;

  // Privacy settings
  discoverable: boolean;
  indexable: boolean;
  manuallyApprovesFollowers: boolean;

  // Public/private key pair for HTTP signatures
  publicKeyId?: string;
  publicKeyPem?: string;
  privateKeyPem?: string;

  // Actor type
  actorType: 'Person' | 'Organization' | 'Service';

  // Content visibility flags
  visibility: 'public' | 'unlisted' | 'followers' | 'private';

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if object is an ActivityPub Actor
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isActor(obj: any): obj is Actor {
  return !!(
    obj &&
    typeof obj === 'object' &&
    obj.inbox &&
    obj.outbox &&
    obj.type &&
    ['Person', 'Group', 'Organization', 'Application', 'Service'].includes(obj.type)
  );
}

/**
 * Check if actor type matches
 */
export function isActorOfType<T extends Actor['type']>(
  actor: Actor,
  type: T
): actor is Actor & { type: T } {
  return actor.type === type;
}
