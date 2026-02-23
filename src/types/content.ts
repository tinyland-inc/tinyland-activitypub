




export type Visibility = 'public' | 'unlisted' | 'followers' | 'private';





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





export interface BlogPost extends BaseContent {
  type: 'blog-post';
  title: string; 
  coverImage?: string;
}





export interface ContentNote extends BaseContent {
  type: 'note';
  title?: string; 
  replyTo?: string; 
  inReplyTo?: string[];
  mood?: string;
  sensitive?: boolean;
  spoilerText?: string;
}





export interface Product extends BaseContent {
  type: 'product';
  name: string; 
  price?: string;
  currency?: string;
  license?: string;
  githubUrl?: string;
  demoUrl?: string;
  downloadUrl?: string;
  coverImage?: string;
}





export interface Profile extends BaseContent {
  type: 'profile';
  name: string; 
  location?: string;
  website?: string;
  pronouns?: string;
  pronounSet?: string[];
}





export interface ContentEvent extends BaseContent {
  type: 'event';
  name: string; 
  startDate: string; 
  endDate?: string;
  location?: string;
  isOnline?: boolean;
  status?: 'tentative' | 'confirmed' | 'cancelled';
}





export interface ContentImage extends BaseContent {
  type: 'image';
  title?: string;
  alt: string;
  url: string;
  width?: number;
  height?: number;
  blurhash?: string;
}





export interface ContentVideo extends BaseContent {
  type: 'video';
  title: string; 
  url: string; 
  thumbnailUrl?: string;
  embedUrl?: string;
  width?: number;
  height?: number;
  duration?: number; 
  language?: string;
  category?: string;
}





export interface ContentDocument extends BaseContent {
  type: 'document';
  title: string; 
  url: string; 
  pages?: number;
  fileType?: string; 
  size?: number; 
}





export interface Tag {
  name: string;
  slug: string;
  count?: number;
  created?: string;
}
