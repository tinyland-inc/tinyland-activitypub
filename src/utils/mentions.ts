/**
 * Mention and Hashtag Parsing Utilities
 * Extracts and processes mentions (@username) and hashtags (#tag) from content
 */

import { getSiteBaseUrl, getInstanceDomain } from '../config.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ParsedMention {
  type: 'Mention';
  href: string;
  name: string;
  handle: string;
  local: boolean;
  domain?: string;
}

export interface ParsedHashtag {
  type: 'Hashtag';
  href: string;
  name: string;
  tag: string;
}

export interface ParsedContent {
  content: string;
  mentions: ParsedMention[];
  hashtags: ParsedHashtag[];
}

// ============================================================================
// Mention Parsing
// ============================================================================

/**
 * Parse mentions from content
 * Supports both @username and @username@domain patterns
 */
export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];

  // Regex pattern for mentions:
  // - @username (local)
  // - @username@domain (remote)
  // - @username@domain.tld (remote with subdomain)
  const mentionRegex = /@([a-zA-Z0-9_-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)/g;

  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    const fullMention = match[0];
    const handlePart = match[1];

    let handle: string;
    let domain: string | undefined;
    let local: boolean;

    if (handlePart.includes('@')) {
      // Remote mention: @username@domain
      const [username, remoteDomain] = handlePart.split('@');
      handle = username;
      domain = remoteDomain;
      local = false;
    } else {
      // Local mention: @username
      handle = handlePart;
      local = true;
      domain = getInstanceDomain();
    }

    mentions.push({
      type: 'Mention',
      href: buildMentionUri(handle, domain, local),
      name: fullMention,
      handle,
      local,
      domain
    });
  }

  return mentions;
}

/**
 * Build ActivityPub mention URI
 */
export function buildMentionUri(
  handle: string,
  domain?: string,
  local = true
): string {
  if (local) {
    return `${getSiteBaseUrl()}/@${handle}`;
  }

  return `https://${domain}/@${handle}`;
}

/**
 * Replace mentions with links in HTML content
 */
export function linkifyMentions(content: string, mentions: ParsedMention[]): string {
  let linkedContent = content;

  // Replace mentions in reverse order to maintain correct indices
  for (let i = mentions.length - 1; i >= 0; i--) {
    const mention = mentions[i];
    const mentionRegex = new RegExp(`@${mention.handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');

    linkedContent = linkedContent.replace(mentionRegex, (match, offset) => {
      // Only replace if it's not already inside a link
      const beforeMatch = linkedContent.substring(0, offset);
      if (beforeMatch.lastIndexOf('<a') > beforeMatch.lastIndexOf('</a>')) {
        // Already inside a link
        return match;
      }

      return `<a href="${mention.href}" class="u-url mention">@${mention.handle}</a>`;
    });
  }

  return linkedContent;
}

// ============================================================================
// Hashtag Parsing
// ============================================================================

/**
 * Parse hashtags from content
 */
export function parseHashtags(content: string): ParsedHashtag[] {
  const hashtags: ParsedHashtag[] = [];

  // Regex pattern for hashtags:
  // - #tag (only alphanumeric and underscore)
  // - Not preceded by word character (to match #hashtag but not #not)
  const hashtagRegex = /(?<!\w)#([a-zA-Z0-9_]+)/g;

  let match: RegExpExecArray | null;
  const seenTags = new Set<string>();

  while ((match = hashtagRegex.exec(content)) !== null) {
    const tag = match[1].toLowerCase();

    // Skip duplicates
    if (seenTags.has(tag)) {
      continue;
    }

    seenTags.add(tag);

    hashtags.push({
      type: 'Hashtag',
      href: buildHashtagUri(tag),
      name: `#${tag}`,
      tag
    });
  }

  return hashtags;
}

/**
 * Build ActivityPub hashtag URI
 */
export function buildHashtagUri(tag: string): string {
  return `${getSiteBaseUrl()}/tags/${tag}`;
}

/**
 * Replace hashtags with links in HTML content
 */
export function linkifyHashtags(content: string, hashtags: ParsedHashtag[]): string {
  let linkedContent = content;

  // Replace hashtags in reverse order to maintain correct indices
  for (let i = hashtags.length - 1; i >= 0; i--) {
    const hashtag = hashtags[i];
    const hashtagRegex = new RegExp(`#${hashtag.tag}`, 'g');

    linkedContent = linkedContent.replace(hashtagRegex, (match, offset) => {
      // Only replace if it's not already inside a link
      const beforeMatch = linkedContent.substring(0, offset);
      if (beforeMatch.lastIndexOf('<a') > beforeMatch.lastIndexOf('</a>')) {
        // Already inside a link
        return match;
      }

      return `<a href="${hashtag.href}" class="mention hashtag">#${hashtag.tag}</a>`;
    });
  }

  return linkedContent;
}

// ============================================================================
// Content Parsing
// ============================================================================

/**
 * Parse content for mentions and hashtags
 */
export function parseContent(content: string): ParsedContent {
  const mentions = parseMentions(content);
  const hashtags = parseHashtags(content);

  // Linkify mentions and hashtags
  const linkedContent = linkifyHashtags(linkifyMentions(content, mentions), hashtags);

  return {
    content: linkedContent,
    mentions,
    hashtags
  };
}

/**
 * Extract unique actor URIs from mentions (for addressing)
 */
export function extractActorUrisFromMentions(mentions: ParsedMention[]): string[] {
  return Array.from(
    new Set(
      mentions.map(m => m.href)
    )
  );
}

/**
 * Build to/cc addressing from mentions
 */
export function buildMentionAddressing(
  visibility: 'public' | 'unlisted' | 'followers' | 'private',
  _actorUri: string,
  actorFollowersUri: string,
  mentions: ParsedMention[]
): { to: string[]; cc: string[] } {
  const to: string[] = [];
  const cc: string[] = [];

  // Get unique actor URIs from mentions
  const mentionActorUris = extractActorUrisFromMentions(mentions);

  // Base addressing based on visibility
  switch (visibility) {
    case 'public':
      to.push('https://www.w3.org/ns/activitystreams#Public');
      if (actorFollowersUri) {
        cc.push(actorFollowersUri);
      }
      break;

    case 'unlisted':
      to.push(actorFollowersUri || '');
      cc.push('https://www.w3.org/ns/activitystreams#Public');
      break;

    case 'followers':
      to.push(actorFollowersUri || '');
      break;

    case 'private':
      // Only addressed to mentioned actors
      break;
  }

  // Add mentioned actors
  if (visibility === 'public' || visibility === 'unlisted') {
    cc.push(...mentionActorUris);
  } else {
    to.push(...mentionActorUris);
  }

  return { to, cc };
}
