



import { describe, it, expect, beforeEach } from 'vitest';
import { configureActivityPub, resetActivityPubConfig } from '../src/config.js';
import {
  parseMentions,
  parseHashtags,
  linkifyMentions,
  parseContent,
  buildMentionAddressing,
  extractActorUrisFromMentions,
  type ParsedMention,
  type ParsedHashtag
} from '../src/utils/mentions.js';

describe('Mentions and Hashtags', () => {
  beforeEach(() => {
    resetActivityPubConfig();
    configureActivityPub({ siteBaseUrl: 'https://example.com' });
  });

  describe('parseMentions', () => {
    it('should parse simple @mentions', () => {
      const mentions = parseMentions('Hello @alice');
      expect(mentions.length).toBeGreaterThanOrEqual(1);
      expect(mentions[0].handle).toBe('alice');
    });

    it('should parse @user@domain mentions', () => {
      const mentions = parseMentions('Hello @bob@mastodon.social');
      expect(mentions.length).toBeGreaterThanOrEqual(1);
      const bob = mentions.find(m => m.handle === 'bob');
      expect(bob).toBeDefined();
      expect(bob?.domain).toBe('mastodon.social');
    });

    it('should return empty array for no mentions', () => {
      const mentions = parseMentions('Hello, World!');
      expect(mentions).toEqual([]);
    });

    it('should handle empty string', () => {
      const mentions = parseMentions('');
      expect(mentions).toEqual([]);
    });
  });

  describe('parseHashtags', () => {
    it('should parse #hashtags', () => {
      const tags = parseHashtags('Hello #world #activitypub');
      expect(tags.length).toBe(2);
      expect(tags[0].tag).toBe('world');
      expect(tags[1].tag).toBe('activitypub');
    });

    it('should return empty array for no hashtags', () => {
      const tags = parseHashtags('Hello, World!');
      expect(tags).toEqual([]);
    });

    it('should handle empty string', () => {
      const tags = parseHashtags('');
      expect(tags).toEqual([]);
    });
  });

  describe('parseContent', () => {
    it('should parse both mentions and hashtags', () => {
      const result = parseContent('Hello @alice #fediverse');
      expect(result.content).toBeDefined();
      expect(result.hashtags.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle content with no mentions or hashtags', () => {
      const result = parseContent('Just a plain message');
      expect(result.content).toBe('Just a plain message');
    });
  });

  describe('extractActorUrisFromMentions', () => {
    it('should extract URIs from parsed mentions', () => {
      const mentions: ParsedMention[] = [
        { handle: 'alice', domain: 'example.com', href: 'https://example.com/@alice', local: true },
        { handle: 'bob', domain: 'mastodon.social', href: 'https://mastodon.social/@bob', local: false }
      ];
      const uris = extractActorUrisFromMentions(mentions);
      expect(uris).toContain('https://example.com/@alice');
      expect(uris).toContain('https://mastodon.social/@bob');
    });

    it('should return empty array for no mentions', () => {
      const uris = extractActorUrisFromMentions([]);
      expect(uris).toEqual([]);
    });
  });

  describe('buildMentionAddressing', () => {
    it('should build public addressing', () => {
      const mentions: ParsedMention[] = [];
      const addressing = buildMentionAddressing(
        'public',
        'https://example.com/@alice',
        'https://example.com/@alice/followers',
        mentions
      );
      expect(addressing.to).toContain('https://www.w3.org/ns/activitystreams#Public');
      expect(addressing.cc).toContain('https://example.com/@alice/followers');
    });

    it('should build followers-only addressing', () => {
      const mentions: ParsedMention[] = [];
      const addressing = buildMentionAddressing(
        'followers',
        'https://example.com/@alice',
        'https://example.com/@alice/followers',
        mentions
      );
      expect(addressing.to).toContain('https://example.com/@alice/followers');
      expect(addressing.to).not.toContain('https://www.w3.org/ns/activitystreams#Public');
    });
  });
});
