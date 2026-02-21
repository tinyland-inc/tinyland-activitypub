/**
 * Content Type Definitions
 * Defines structures for internal content types used by ActivityPub services
 */

export type Visibility = 'public' | 'unlisted' | 'followers' | 'private';

// ============================================================================
// Base Content Interface
// ============================================================================

export interface BaseContent {
  id?: string;
  slug: string;
  title?: string;
  description?: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  tags: string[];
  categories: string[];
  authorHandle: string;
  authorName?: string;
  authorAvatar?: string;
  visibility: Visibility;
  date: string;
  publishedAt: string;
  updatedAt?: string;
  wordCount?: number;
  readingTime?: number;
}

// ============================================================================
// Blog Post (Article)
// ============================================================================

export interface BlogPost extends BaseContent {
  type: 'blog-post';
  title: string; // Required
  coverImage?: string;
}

// ============================================================================
// Note (Micro-post/Status Update)
// ============================================================================

export interface ContentNote extends BaseContent {
  type: 'note';
  title?: string; // Optional
  replyTo?: string; // ActivityPub object URI
  inReplyTo?: string[];
  mood?: string;
  sensitive?: boolean;
  spoilerText?: string;
}

// ============================================================================
// Product (Page/Item)
// ============================================================================

export interface Product extends BaseContent {
  type: 'product';
  name: string; // Required (maps to title)
  price?: string;
  currency?: string;
  license?: string;
  githubUrl?: string;
  demoUrl?: string;
  downloadUrl?: string;
  coverImage?: string;
}

// ============================================================================
// Profile (Person/Group)
// ============================================================================

export interface Profile extends BaseContent {
  type: 'profile';
  name: string; // Required
  location?: string;
  website?: string;
  pronouns?: string;
  pronounSet?: string[];
}

// ============================================================================
// Event (Event)
// ============================================================================

export interface ContentEvent extends BaseContent {
  type: 'event';
  name: string; // Required
  startDate: string; // ISO 8601
  endDate?: string;
  location?: string;
  isOnline?: boolean;
  status?: 'tentative' | 'confirmed' | 'cancelled';
}

// ============================================================================
// Image (Media)
// ============================================================================

export interface ContentImage extends BaseContent {
  type: 'image';
  title?: string;
  alt: string;
  url: string;
  width?: number;
  height?: number;
  blurhash?: string;
}

// ============================================================================
// Video (Media - PeerTube compatible)
// ============================================================================

export interface ContentVideo extends BaseContent {
  type: 'video';
  title: string; // Required
  url: string; // Direct video URL
  thumbnailUrl?: string;
  embedUrl?: string;
  width?: number;
  height?: number;
  duration?: number; // Seconds
  language?: string;
  category?: string;
}

// ============================================================================
// Document (PDF/Docs)
// ============================================================================

export interface ContentDocument extends BaseContent {
  type: 'document';
  title: string; // Required
  url: string; // PDF URL
  pages?: number;
  fileType?: string; // e.g., 'application/pdf'
  size?: number; // Bytes
}

// ============================================================================
// Tag / Hashtag
// ============================================================================

export interface Tag {
  name: string;
  slug: string;
  count?: number;
  created?: string;
}
