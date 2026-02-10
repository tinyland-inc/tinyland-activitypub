/**
 * ActivityPub Content Hooks
 *
 * Provides hooks for automatically syncing local content
 * changes to the fediverse.
 */

// ============================================================================
// Core Exports
// ============================================================================

export {
  publishToFediverse,
  updateOnFediverse,
  deleteFromFediverse,
  announceContent,
  type PublishOptions,
  type PublishResult,
  type PublishableContent,
  type FederatedVisibility
} from './contentPublishHook.js';

// ============================================================================
// Convenience Functions
// ============================================================================

import {
  publishToFediverse,
  updateOnFediverse,
  deleteFromFediverse,
  type PublishableContent,
  type PublishResult,
  type FederatedVisibility
} from './contentPublishHook.js';

/**
 * Hook called when new content is created
 */
export async function onContentCreated(
  content: PublishableContent & { fediverseVisibility?: FederatedVisibility },
  authorHandle: string
): Promise<PublishResult> {
  const visibility = content.fediverseVisibility || mapVisibility(content.visibility);

  if (visibility === 'private') {
    return {
      success: true,
      error: 'Content is private, not federating'
    };
  }

  return publishToFediverse(content, authorHandle, { visibility });
}

/**
 * Hook called when content is updated
 */
export async function onContentUpdated(
  content: PublishableContent & { fediverseVisibility?: FederatedVisibility },
  authorHandle: string
): Promise<PublishResult> {
  const visibility = content.fediverseVisibility || mapVisibility(content.visibility);

  if (visibility === 'private') {
    return {
      success: true,
      error: 'Content is private, not federating'
    };
  }

  return updateOnFediverse(content, authorHandle);
}

/**
 * Hook called when content is deleted
 */
export async function onContentDeleted(
  contentId: string,
  contentType: string,
  authorHandle: string
): Promise<PublishResult> {
  return deleteFromFediverse(contentId, contentType, authorHandle);
}

/**
 * Hook called when content is announced (boosted/reblogged)
 */
export async function onContentAnnounced(
  contentUrl: string,
  announcerHandle: string
): Promise<PublishResult> {
  const { announceContent } = await import('./contentPublishHook.js');
  return announceContent(contentUrl, announcerHandle);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map internal visibility to federated visibility
 */
export function mapVisibility(visibility: string): FederatedVisibility {
  switch (visibility) {
    case 'public':
      return 'public';
    case 'unlisted':
      return 'unlisted';
    case 'followers':
      return 'followers';
    case 'private':
      return 'private';
    default:
      return 'public';
  }
}

// ============================================================================
// Content Type to ActivityStreams Type Mapping
// ============================================================================

/**
 * Map internal content type to ActivityStreams type for deletion
 */
export function getActivityStreamsType(contentType: string): string {
  const typeMap: Record<string, string> = {
    'blog-post': 'Article',
    'note': 'Note',
    'product': 'Object',
    'event': 'Event',
    'image': 'Image',
    'video': 'Video',
    'document': 'Document',
    'profile': 'Profile'
  };

  return typeMap[contentType] || 'Object';
}

/**
 * Build ActivityPub object ID from content
 */
export function buildObjectId(
  baseUrl: string,
  authorHandle: string,
  contentType: string,
  slug: string
): string {
  const typePathMap: Record<string, string> = {
    'blog-post': 'blog',
    'note': 'notes',
    'product': 'products',
    'event': 'events',
    'image': 'images',
    'video': 'videos',
    'document': 'docs'
  };

  const path = typePathMap[contentType] || 'content';
  return `${baseUrl}/@${authorHandle}/${path}/${slug}`;
}
