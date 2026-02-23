










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





import {
  publishToFediverse,
  updateOnFediverse,
  deleteFromFediverse,
  type PublishableContent,
  type PublishResult,
  type FederatedVisibility
} from './contentPublishHook.js';




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




export async function onContentDeleted(
  contentId: string,
  contentType: string,
  authorHandle: string
): Promise<PublishResult> {
  return deleteFromFediverse(contentId, contentType, authorHandle);
}




export async function onContentAnnounced(
  contentUrl: string,
  announcerHandle: string
): Promise<PublishResult> {
  const { announceContent } = await import('./contentPublishHook.js');
  return announceContent(contentUrl, announcerHandle);
}








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
