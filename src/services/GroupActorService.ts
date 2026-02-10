/**
 * Group Actor Service
 * Manages ActivityPub Group actors for community federation
 *
 * Groups are compatible with:
 * - Lemmy (community federation)
 * - Guppe Groups
 * - Mastodon Groups
 *
 * Reference:
 * - https://www.w3.org/TR/activitypub/#group
 * - https://join-lemmy.org/docs/contributors/05-federation.html
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import type { Group } from '../types/activitystreams.js';
import { getSiteBaseUrl, getActivityPubDir } from '../config.js';

// ============================================================================
// Directory Initialization
// ============================================================================

function getGroupsDir(): string {
  return join(getActivityPubDir(), 'groups');
}

function ensureGroupsDir(): void {
  const dir = getGroupsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Stored group representation
 */
export interface StoredGroup {
  id: string;
  handle: string;
  displayName: string;
  summary: string;
  iconUrl?: string;
  imageUrl?: string;
  visibility: 'public' | 'unlisted' | 'private';
  postingRestrictedToMods: boolean;
  nsfw: boolean;
  publicKeyId: string;
  publicKeyPem: string;
  privateKeyPem: string;
  createdAt: string;
  updatedAt: string;
  // Lemmy-specific
  moderators: string[]; // Array of actor URIs
  categories: string[];
  language?: string;
}

/**
 * Group creation input
 */
export interface CreateGroupInput {
  handle: string;
  displayName: string;
  summary: string;
  iconUrl?: string;
  imageUrl?: string;
  visibility?: 'public' | 'unlisted' | 'private';
  postingRestrictedToMods?: boolean;
  nsfw?: boolean;
  categories?: string[];
  language?: string;
  moderatorHandles?: string[];
}

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate RSA key pair for HTTP signatures
 */
function generateGroupKeyPair(handle: string): {
  publicKeyId: string;
  publicKeyPem: string;
  privateKeyPem: string;
} {
  const baseUrl = getSiteBaseUrl();
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  const groupUri = `${baseUrl}/c/${handle}`;
  const publicKeyId = `${groupUri}#main-key`;

  return {
    publicKeyId,
    publicKeyPem: publicKey,
    privateKeyPem: privateKey
  };
}

// ============================================================================
// Group CRUD Operations
// ============================================================================

/**
 * Create a new group/community
 */
export function createGroup(input: CreateGroupInput): StoredGroup {
  const baseUrl = getSiteBaseUrl();
  const groupUri = `${baseUrl}/c/${input.handle}`;

  // Check if group already exists
  const existing = getStoredGroup(input.handle);
  if (existing) {
    throw new Error(`Group ${input.handle} already exists`);
  }

  // Generate key pair
  const keyPair = generateGroupKeyPair(input.handle);

  // Build moderator URIs
  const moderators = (input.moderatorHandles || []).map(
    (handle) => `${baseUrl}/@${handle}`
  );

  const now = new Date().toISOString();

  const group: StoredGroup = {
    id: groupUri,
    handle: input.handle,
    displayName: input.displayName,
    summary: input.summary,
    iconUrl: input.iconUrl,
    imageUrl: input.imageUrl,
    visibility: input.visibility || 'public',
    postingRestrictedToMods: input.postingRestrictedToMods || false,
    nsfw: input.nsfw || false,
    publicKeyId: keyPair.publicKeyId,
    publicKeyPem: keyPair.publicKeyPem,
    privateKeyPem: keyPair.privateKeyPem,
    createdAt: now,
    updatedAt: now,
    moderators,
    categories: input.categories || [],
    language: input.language
  };

  // Store group
  storeGroup(input.handle, group);

  return group;
}

/**
 * Get group by handle
 */
export function getGroupByHandle(handle: string): Group | null {
  const stored = getStoredGroup(handle);

  if (!stored) {
    return null;
  }

  return storedGroupToActivityPub(stored);
}

/**
 * List all groups
 */
export function listGroups(): StoredGroup[] {
  ensureGroupsDir();
  const groupsDir = getGroupsDir();

  try {
    const files = readdirSync(groupsDir).filter((f) => f.endsWith('.json'));
    const groups: StoredGroup[] = [];

    for (const file of files) {
      const filePath = join(groupsDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const group = JSON.parse(content) as StoredGroup;

      // Only include public groups in listings
      if (group.visibility === 'public') {
        groups.push(group);
      }
    }

    return groups;
  } catch (error) {
    console.error('[GroupActor] Failed to list groups:', error);
    return [];
  }
}

/**
 * Update group
 */
export function updateGroup(
  handle: string,
  updates: Partial<CreateGroupInput>
): StoredGroup | null {
  const baseUrl = getSiteBaseUrl();
  const existing = getStoredGroup(handle);

  if (!existing) {
    return null;
  }

  const updated: StoredGroup = {
    ...existing,
    displayName: updates.displayName ?? existing.displayName,
    summary: updates.summary ?? existing.summary,
    iconUrl: updates.iconUrl ?? existing.iconUrl,
    imageUrl: updates.imageUrl ?? existing.imageUrl,
    visibility: updates.visibility ?? existing.visibility,
    postingRestrictedToMods:
      updates.postingRestrictedToMods ?? existing.postingRestrictedToMods,
    nsfw: updates.nsfw ?? existing.nsfw,
    categories: updates.categories ?? existing.categories,
    language: updates.language ?? existing.language,
    updatedAt: new Date().toISOString()
  };

  if (updates.moderatorHandles) {
    updated.moderators = updates.moderatorHandles.map(
      (h) => `${baseUrl}/@${h}`
    );
  }

  storeGroup(handle, updated);

  return updated;
}

/**
 * Delete group
 */
export function deleteGroup(handle: string): boolean {
  ensureGroupsDir();
  const filePath = join(getGroupsDir(), `${handle}.json`);

  if (!existsSync(filePath)) {
    return false;
  }

  try {
    unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error(`[GroupActor] Failed to delete group ${handle}:`, error);
    return false;
  }
}

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Get stored group from file system
 */
function getStoredGroup(handle: string): StoredGroup | null {
  ensureGroupsDir();
  const filePath = join(getGroupsDir(), `${handle}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as StoredGroup;
  } catch (error) {
    console.error(`[GroupActor] Failed to load group ${handle}:`, error);
    return null;
  }
}

/**
 * Store group to file system
 */
function storeGroup(handle: string, group: StoredGroup): void {
  ensureGroupsDir();
  const filePath = join(getGroupsDir(), `${handle}.json`);

  try {
    writeFileSync(filePath, JSON.stringify(group, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[GroupActor] Failed to store group ${handle}:`, error);
  }
}

// ============================================================================
// ActivityPub Conversion
// ============================================================================

/**
 * Convert stored group to ActivityPub Group object
 */
export function storedGroupToActivityPub(stored: StoredGroup): Group {
  const baseUrl = getSiteBaseUrl();
  const groupUri = stored.id;

  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
      {
        // Lemmy extensions
        lemmy: 'https://join-lemmy.org/ns#',
        postingRestrictedToMods: 'lemmy:postingRestrictedToMods',
        moderators: 'lemmy:moderators',
        sensitive: 'as:sensitive',
        // Mastodon extensions
        toot: 'http://joinmastodon.org/ns#',
        discoverable: 'toot:discoverable',
        indexable: 'toot:indexable'
      }
    ],
    id: groupUri,
    type: 'Group',
    preferredUsername: stored.handle,
    name: stored.displayName,
    summary: stored.summary,
    inbox: `${groupUri}/inbox`,
    outbox: `${groupUri}/outbox`,
    followers: `${groupUri}/followers`,
    // Group-specific properties
    attributedTo: stored.moderators, // Moderators as attributed actors
    icon: stored.iconUrl
      ? {
          type: 'Image',
          url: stored.iconUrl.startsWith('http')
            ? stored.iconUrl
            : `${baseUrl}${stored.iconUrl}`
        }
      : undefined,
    image: stored.imageUrl
      ? {
          type: 'Image',
          url: stored.imageUrl.startsWith('http')
            ? stored.imageUrl
            : `${baseUrl}${stored.imageUrl}`
        }
      : undefined,
    // Discovery
    discoverable: stored.visibility === 'public',
    indexable: stored.visibility === 'public',
    // Lemmy compatibility
    postingRestrictedToMods: stored.postingRestrictedToMods,
    moderators: stored.moderators,
    sensitive: stored.nsfw,
    // Authentication
    publicKey: {
      id: stored.publicKeyId,
      owner: groupUri,
      publicKeyPem: stored.publicKeyPem
    },
    // Timestamps
    published: stored.createdAt,
    updated: stored.updatedAt,
    // Endpoints
    endpoints: {
      sharedInbox: `${baseUrl}/inbox`
    }
  } as Group;
}

/**
 * Get group private key for signing
 */
export function getGroupPrivateKey(handle: string): string | null {
  const stored = getStoredGroup(handle);
  return stored?.privateKeyPem || null;
}
