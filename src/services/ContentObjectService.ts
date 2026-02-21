/**
 * Content Object Service
 * Converts internal content types to ActivityPub objects
 */

import { getActorUri } from '../config.js';
import { parseContent } from '../utils/mentions.js';
import type {
  BlogPost,
  ContentNote,
  Product,
  Profile,
  ContentImage,
  ContentVideo,
  ContentDocument
} from '../types/content.js';
import type {
  Article,
  Note as NoteObject,
  Image as ImageObject,
  Video as VideoObject,
  Document as DocumentObject,
  ASObject,
} from '../types/activitystreams.js';

// ============================================================================
// Base Object Conversion
// ============================================================================

/**
 * Convert internal content to ActivityPub object
 */
export async function createObject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any,
  actorHandle: string
): Promise<ASObject | null> {
  if (!content || !actorHandle) {
    return null;
  }

  switch (content.type) {
    case 'blog-post':
      return convertBlogPostToArticle(content, actorHandle);

    case 'note':
      return convertNoteToNoteObject(content, actorHandle);

    case 'product':
      return convertProductToObject(content, actorHandle);

    case 'profile':
      return convertProfileToObject(content, actorHandle);

    case 'image':
      return convertImageToImageObject(content, actorHandle);

    case 'video':
      return convertVideoToVideoObject(content, actorHandle);

    case 'document':
      return convertDocumentToDocumentObject(content, actorHandle);

    default:
      console.error(`[ContentObjectService] Unknown content type: ${content.type}`);
      return null;
  }
}

// ============================================================================
// Blog Post (Article)
// ============================================================================

export function convertBlogPostToArticle(
  post: BlogPost,
  actorHandle: string
): Article {
  const actorUriVal = getActorUri(actorHandle);
  const objectUri = `${actorUriVal}/blog/${post.slug}`;

  const { content: processedContent, hashtags } = parseContent(post.content);

  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1'
    ],
    type: 'Article',
    id: objectUri,
    name: post.title,
    summary: post.excerpt || post.description,
    content: processedContent,
    mediaType: 'text/markdown',
    url: objectUri,
    published: post.publishedAt,
    updated: post.updatedAt,
    attributedTo: actorUriVal,
    to: post.visibility === 'public' ? ['https://www.w3.org/ns/activitystreams#Public'] : [],
    cc: [`${actorUriVal}/followers`],
    tag: [...hashtags, ...createHashtagTags(post.tags)],
    attachment: post.featuredImage ? [createImageAttachment(post.featuredImage)] : [],
    likes: `${objectUri}/likes`,
    shares: `${objectUri}/announces`,
    replies: `${objectUri}/replies`
  };
}

// ============================================================================
// Note (Status Update/Micro-post)
// ============================================================================

export function convertNoteToNoteObject(
  note: ContentNote,
  actorHandle: string
): NoteObject {
  const actorUriVal = getActorUri(actorHandle);
  const objectUri = `${actorUriVal}/notes/${note.slug}`;

  const { content: processedContent, hashtags } = parseContent(note.content);

  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
      {
        'sensitive': 'as:sensitive',
        'spoilerText': 'as:summary'
      }
    ],
    type: 'Note',
    id: objectUri,
    summary: note.spoilerText,
    content: processedContent,
    mediaType: 'text/markdown',
    sensitive: note.sensitive || false,
    url: objectUri,
    published: note.publishedAt,
    updated: note.updatedAt,
    attributedTo: actorUriVal,
    to: note.visibility === 'public' ? ['https://www.w3.org/ns/activitystreams#Public'] : [],
    cc: [`${actorUriVal}/followers`],
    tag: [...hashtags, ...createHashtagTags(note.tags)],
    inReplyTo: note.inReplyTo,
    likes: `${objectUri}/likes`,
    shares: `${objectUri}/announces`,
    replies: `${objectUri}/replies`
  };
}

// ============================================================================
// Product (Object)
// ============================================================================

export function convertProductToObject(
  product: Product,
  actorHandle: string
): ASObject {
  const actorUriVal = getActorUri(actorHandle);
  const objectUri = `${actorUriVal}/products/${product.slug}`;

  const { content: processedContent } = parseContent(product.content);

  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
      { 'schema': 'http://schema.org/' }
    ],
    type: 'Object',
    id: objectUri,
    name: product.name,
    summary: product.description,
    content: processedContent,
    mediaType: 'text/markdown',
    url: objectUri,
    published: product.publishedAt,
    updated: product.updatedAt,
    attributedTo: actorUriVal,
    to: product.visibility === 'public' ? ['https://www.w3.org/ns/activitystreams#Public'] : [],
    cc: [`${actorUriVal}/followers`],
    tag: createHashtagTags(product.tags),
    attachment: [
      ...(product.featuredImage ? [createImageAttachment(product.featuredImage)] : []),
      ...(product.githubUrl ? [{ type: 'Link', mediaType: 'text/html', name: 'GitHub', href: product.githubUrl }] : []),
      ...(product.demoUrl ? [{ type: 'Link', mediaType: 'text/html', name: 'Demo', href: product.demoUrl }] : []),
      ...(product.downloadUrl ? [{ type: 'Link', mediaType: 'application/zip', name: 'Download', href: product.downloadUrl }] : [])
    ],
    likes: `${objectUri}/likes`,
    shares: `${objectUri}/announces`
  };
}

// ============================================================================
// Profile (Person)
// ============================================================================

export function convertProfileToObject(
  profile: Profile,
  actorHandle: string
): ASObject {
  const actorUriVal = getActorUri(actorHandle);

  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1'
    ],
    type: 'Profile',
    id: `${actorUriVal}/#profile`,
    name: profile.name,
    summary: profile.content,
    url: `${actorUriVal}/home`,
    published: profile.publishedAt,
    updated: profile.updatedAt,
    attributedTo: actorUriVal,
    to: ['https://www.w3.org/ns/activitystreams#Public']
  };
}

// ============================================================================
// Image (Media)
// ============================================================================

export function convertImageToImageObject(
  image: ContentImage,
  actorHandle: string
): ImageObject {
  const actorUriVal = getActorUri(actorHandle);
  const objectUri = `${actorUriVal}/images/${image.slug}`;

  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
      { 'schema': 'http://schema.org/' }
    ],
    type: 'Image',
    id: objectUri,
    name: image.title,
    url: image.url,
    href: objectUri,
    mediaType: 'image/jpeg',
    width: image.width,
    height: image.height,
    alt: image.alt,
    published: image.publishedAt,
    updated: image.updatedAt,
    attributedTo: actorUriVal,
    to: image.visibility === 'public' ? ['https://www.w3.org/ns/activitystreams#Public'] : [],
    cc: [`${actorUriVal}/followers`],
    tag: createHashtagTags(image.tags)
  };
}

// ============================================================================
// Video (PeerTube Compatible)
// ============================================================================

export function convertVideoToVideoObject(
  video: ContentVideo,
  actorHandle: string
): VideoObject {
  const actorUriVal = getActorUri(actorHandle);
  const objectUri = `${actorUriVal}/videos/${video.slug}`;

  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
      {
        'schema': 'http://schema.org/',
        'pt': 'https://joinpeertube.org/ns#',
        'width': { '@id': 'schema:width', '@type': 'xsd:nonNegativeInteger' },
        'height': { '@id': 'schema:height', '@type': 'xsd:nonNegativeInteger' },
        'duration': { '@id': 'schema:duration', '@type': 'xsd:duration' }
      }
    ],
    type: 'Video',
    id: objectUri,
    name: video.title,
    summary: video.description,
    content: video.content,
    mediaType: 'text/markdown',
    url: objectUri,
    published: video.publishedAt,
    updated: video.updatedAt,
    attributedTo: actorUriVal,
    to: video.visibility === 'public' ? ['https://www.w3.org/ns/activitystreams#Public'] : [],
    cc: [`${actorUriVal}/followers`],
    tag: createHashtagTags(video.tags),
    duration: `PT${video.duration || 0}S`,
    icon: video.thumbnailUrl ? { type: 'Image', url: video.thumbnailUrl } : undefined,
    width: video.width,
    height: video.height,
    likes: `${objectUri}/likes`,
    shares: `${objectUri}/announces`
  };
}

// ============================================================================
// Document (PDF/Docs)
// ============================================================================

export function convertDocumentToDocumentObject(
  doc: ContentDocument,
  actorHandle: string
): DocumentObject {
  const actorUriVal = getActorUri(actorHandle);
  const objectUri = `${actorUriVal}/docs/${doc.slug}`;

  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
      { 'schema': 'http://schema.org/' }
    ],
    type: 'Document',
    id: objectUri,
    name: doc.title,
    summary: doc.description,
    content: doc.content,
    mediaType: 'text/markdown',
    url: objectUri,
    published: doc.publishedAt,
    updated: doc.updatedAt,
    attributedTo: actorUriVal,
    to: doc.visibility === 'public' ? ['https://www.w3.org/ns/activitystreams#Public'] : [],
    cc: [`${actorUriVal}/followers`],
    tag: createHashtagTags(doc.tags),
    attachment: [
      {
        type: 'Document',
        id: `${objectUri}/attachment`,
        mediaType: doc.fileType || 'application/pdf',
        url: doc.url,
        name: doc.title,
        size: doc.size
      } as DocumentObject
    ]
  };
}

// ============================================================================
// Helpers
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createHashtagTags(tags: string[]): any[] {
  return tags.map(tag => ({
    type: 'Hashtag',
    href: `/tags/${tag}`,
    name: `#${tag}`
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createImageAttachment(url: string): any {
  return {
    type: 'Image',
    mediaType: 'image/jpeg',
    url
  };
}
