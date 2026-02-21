/**
 * Featured Collection Service
 * Manages featured/pinned posts for ActivityPub actors
 *
 * The featured collection is a list of posts that the user has pinned
 * to their profile, shown on Mastodon-compatible clients.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { OrderedCollection, Note as NoteObject, Article } from '../types/activitystreams.js';
import { getSiteBaseUrl, getActorUri } from '../config.js';

// ============================================================================
// Types
// ============================================================================

export interface FeaturedItem {
  slug: string;
  type: 'blog' | 'note' | 'product';
  title: string;
  summary?: string;
  url: string;
  activityUri: string;
  publishedAt: string;
  featured: boolean;
}

/**
 * Callback to parse frontmatter from markdown files.
 * The package consumer must provide this via config or direct call.
 */
export type FrontmatterParser = (fileContent: string) => {
  data: Record<string, unknown>;
  content: string;
};

// ============================================================================
// Configuration
// ============================================================================

/**
 * Default frontmatter parser that just returns empty data.
 * Consumers should provide a real parser (e.g., gray-matter).
 */
let _frontmatterParser: FrontmatterParser | null = null;

/**
 * Set the frontmatter parser (e.g., gray-matter)
 */
export function setFrontmatterParser(parser: FrontmatterParser): void {
  _frontmatterParser = parser;
}

function parseFrontmatter(content: string): { data: Record<string, unknown>; content: string } {
  if (_frontmatterParser) {
    return _frontmatterParser(content);
  }
  // Fallback: return empty data
  return { data: {}, content };
}

// ============================================================================
// Featured Collection Functions
// ============================================================================

/**
 * Get featured posts for an actor
 */
export function getFeaturedPosts(handle: string, contentDir?: string): FeaturedItem[] {
  const featured: FeaturedItem[] = [];
  const baseUrl = getSiteBaseUrl();
  const resolvedContentDir = contentDir || join(process.cwd(), 'src', 'content');

  // Scan blog posts for featured items
  const blogDir = join(resolvedContentDir, 'blog');
  if (existsSync(blogDir)) {
    try {
      const files = readdirSync(blogDir).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = join(blogDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const { data } = parseFrontmatter(content);

        if (data.featured === true && data.published !== false) {
          const slug = file.replace('.md', '');
          featured.push({
            slug,
            type: 'blog',
            title: (data.title as string) || 'Untitled',
            summary: (data.excerpt as string) || (data.description as string),
            url: `${baseUrl}/@${handle}/blog/${slug}`,
            activityUri: `${getActorUri(handle)}/blog/${slug}`,
            publishedAt: (data.publishedAt as string) || (data.date as string),
            featured: true
          });
        }
      }
    } catch (error) {
      console.error('[Featured] Failed to scan blog posts:', error);
    }
  }

  // Scan notes for featured items
  const notesDir = join(resolvedContentDir, 'notes');
  if (existsSync(notesDir)) {
    try {
      const files = readdirSync(notesDir).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = join(notesDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const { data } = parseFrontmatter(content);

        if (data.featured === true && data.published !== false) {
          const slug = file.replace('.md', '');
          featured.push({
            slug,
            type: 'note',
            title: (data.title as string) || 'Note',
            summary: typeof data.content === 'string' ? data.content.substring(0, 200) : undefined,
            url: `${baseUrl}/@${handle}/notes/${slug}`,
            activityUri: `${getActorUri(handle)}/notes/${slug}`,
            publishedAt: (data.publishedAt as string) || (data.date as string),
            featured: true
          });
        }
      }
    } catch (error) {
      console.error('[Featured] Failed to scan notes:', error);
    }
  }

  // Scan products for featured items
  const productsDir = join(resolvedContentDir, 'products');
  if (existsSync(productsDir)) {
    try {
      const files = readdirSync(productsDir).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = join(productsDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const { data } = parseFrontmatter(content);

        if (data.featured === true && data.published !== false) {
          const slug = file.replace('.md', '');
          featured.push({
            slug,
            type: 'product',
            title: (data.name as string) || 'Product',
            summary: data.description as string,
            url: `${baseUrl}/@${handle}/products/${slug}`,
            activityUri: `${getActorUri(handle)}/products/${slug}`,
            publishedAt: (data.publishedAt as string) || (data.date as string),
            featured: true
          });
        }
      }
    } catch (error) {
      console.error('[Featured] Failed to scan products:', error);
    }
  }

  // Sort by date (newest first)
  return featured.sort((a, b) => {
    const dateA = new Date(a.publishedAt || 0).getTime();
    const dateB = new Date(b.publishedAt || 0).getTime();
    return dateB - dateA;
  });
}

/**
 * Convert featured item to ActivityPub object
 */
export function featuredItemToActivity(item: FeaturedItem, handle: string): NoteObject | Article {
  const actorUri = getActorUri(handle);

  if (item.type === 'note') {
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: item.activityUri,
      type: 'Note',
      attributedTo: actorUri,
      content: item.summary || '',
      url: item.url,
      published: item.publishedAt
    };
  }

  // Blog posts and products are Articles
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: item.activityUri,
    type: 'Article',
    attributedTo: actorUri,
    name: item.title,
    content: item.summary || '',
    summary: item.summary,
    url: item.url,
    published: item.publishedAt
  };
}

/**
 * Get featured collection as ActivityPub OrderedCollection
 */
export function getFeaturedCollection(handle: string, contentDir?: string): OrderedCollection {
  const actorUri = getActorUri(handle);
  const featuredItems = getFeaturedPosts(handle, contentDir);

  // Convert items to ActivityPub objects
  const orderedItems = featuredItems.map(item =>
    featuredItemToActivity(item, handle)
  );

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${actorUri}/featured`,
    type: 'OrderedCollection',
    totalItems: orderedItems.length,
    orderedItems
  };
}
