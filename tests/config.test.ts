



import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureActivityPub,
  getActivityPubConfig,
  resetActivityPubConfig,
  getSiteBaseUrl,
  getInstanceDomain,
  getActivityPubDir,
  getActorsDir,
  getActorUri,
  getInboxUri,
  getOutboxUri,
  getFollowersUri,
  getFollowingUri,
  getLikedUri,
  getWebFingerResource,
  isLocalUri,
  extractHandleFromUri,
  getInternalContentType,
  isReplyable,
  isLikable,
  isBoostable,
  CONTENT_TYPE_MAPPING,
  REPLYABLE_TYPES,
  LIKABLE_TYPES,
  BOOSTABLE_TYPES
} from '../src/config.js';

describe('ActivityPub Configuration', () => {
  beforeEach(() => {
    resetActivityPubConfig();
  });

  describe('configureActivityPub', () => {
    it('should use defaults when not configured', () => {
      const config = getActivityPubConfig();
      expect(config.siteBaseUrl).toBe('https://tinyland.dev');
      expect(config.federationEnabled).toBe(true);
      expect(config.defaultVisibility).toBe('public');
      expect(config.autoApproveFollows).toBe(false);
      expect(config.maxDeliveryRetries).toBe(3);
      expect(config.federationTimeout).toBe(10000);
    });

    it('should merge custom config with defaults', () => {
      configureActivityPub({
        siteBaseUrl: 'https://example.com',
        federationEnabled: false
      });

      const config = getActivityPubConfig();
      expect(config.siteBaseUrl).toBe('https://example.com');
      expect(config.federationEnabled).toBe(false);
      
      expect(config.autoApproveFollows).toBe(false);
      expect(config.maxDeliveryRetries).toBe(3);
    });

    it('should reset configuration', () => {
      configureActivityPub({ siteBaseUrl: 'https://custom.dev' });
      expect(getSiteBaseUrl()).toBe('https://custom.dev');

      resetActivityPubConfig();
      expect(getSiteBaseUrl()).toBe('https://tinyland.dev');
    });
  });

  describe('getSiteBaseUrl', () => {
    it('should return base URL without trailing slash', () => {
      configureActivityPub({ siteBaseUrl: 'https://example.com/' });
      expect(getSiteBaseUrl()).toBe('https://example.com');
    });

    it('should return base URL as-is when no trailing slash', () => {
      configureActivityPub({ siteBaseUrl: 'https://example.com' });
      expect(getSiteBaseUrl()).toBe('https://example.com');
    });
  });

  describe('getInstanceDomain', () => {
    it('should extract hostname from URL', () => {
      configureActivityPub({ siteBaseUrl: 'https://example.com' });
      expect(getInstanceDomain()).toBe('example.com');
    });

    it('should handle URLs with ports', () => {
      configureActivityPub({ siteBaseUrl: 'https://example.com:8080' });
      expect(getInstanceDomain()).toBe('example.com');
    });

    it('should fallback to tinyland.dev for invalid URLs', () => {
      configureActivityPub({ siteBaseUrl: 'not-a-url' });
      expect(getInstanceDomain()).toBe('tinyland.dev');
    });
  });

  describe('getActivityPubDir', () => {
    it('should resolve relative paths', () => {
      configureActivityPub({ activitypubDir: '.activitypub' });
      const dir = getActivityPubDir();
      expect(dir).toContain('.activitypub');
      expect(dir).not.toBe('.activitypub');
    });

    it('should keep absolute paths', () => {
      configureActivityPub({ activitypubDir: '/tmp/ap-data' });
      expect(getActivityPubDir()).toBe('/tmp/ap-data');
    });
  });

  describe('getActorsDir', () => {
    it('should return actors subdirectory', () => {
      configureActivityPub({ activitypubDir: '/tmp/ap-data' });
      expect(getActorsDir()).toBe('/tmp/ap-data/actors');
    });
  });

  describe('URI helpers', () => {
    beforeEach(() => {
      configureActivityPub({ siteBaseUrl: 'https://example.com' });
    });

    it('should build actor URI', () => {
      expect(getActorUri('alice')).toBe('https://example.com/@alice');
    });

    it('should build inbox URI', () => {
      expect(getInboxUri('alice')).toBe('https://example.com/@alice/inbox');
    });

    it('should build outbox URI', () => {
      expect(getOutboxUri('alice')).toBe('https://example.com/@alice/outbox');
    });

    it('should build followers URI', () => {
      expect(getFollowersUri('alice')).toBe('https://example.com/@alice/followers');
    });

    it('should build following URI', () => {
      expect(getFollowingUri('alice')).toBe('https://example.com/@alice/following');
    });

    it('should build liked URI', () => {
      expect(getLikedUri('alice')).toBe('https://example.com/@alice/liked');
    });

    it('should build WebFinger resource', () => {
      expect(getWebFingerResource('alice')).toBe('acct:alice@example.com');
    });
  });

  describe('isLocalUri', () => {
    beforeEach(() => {
      configureActivityPub({ siteBaseUrl: 'https://example.com' });
    });

    it('should return true for local URIs', () => {
      expect(isLocalUri('https://example.com/@alice')).toBe(true);
    });

    it('should return false for remote URIs', () => {
      expect(isLocalUri('https://mastodon.social/@bob')).toBe(false);
    });

    it('should return false for invalid URIs', () => {
      expect(isLocalUri('not-a-url')).toBe(false);
    });
  });

  describe('extractHandleFromUri', () => {
    beforeEach(() => {
      configureActivityPub({ siteBaseUrl: 'https://example.com' });
    });

    it('should extract handle from local URI', () => {
      expect(extractHandleFromUri('https://example.com/@alice')).toBe('alice');
    });

    it('should return null for remote URIs', () => {
      expect(extractHandleFromUri('https://mastodon.social/@bob')).toBe(null);
    });

    it('should return null for URIs without handle', () => {
      expect(extractHandleFromUri('https://example.com/about')).toBe(null);
    });
  });

  describe('Content type mapping', () => {
    it('should map blog to Article', () => {
      expect(getInternalContentType('blog')).toBe('Article');
    });

    it('should map event to Event', () => {
      expect(getInternalContentType('event')).toBe('Event');
    });

    it('should default to Note for unknown types', () => {
      expect(getInternalContentType('unknown')).toBe('Note');
    });
  });

  describe('Type capability checks', () => {
    it('should identify replyable types', () => {
      expect(isReplyable('Note')).toBe(true);
      expect(isReplyable('Article')).toBe(true);
      expect(isReplyable('Image')).toBe(false);
    });

    it('should identify likable types', () => {
      expect(isLikable('Note')).toBe(true);
      expect(isLikable('Video')).toBe(true);
      expect(isLikable('Group')).toBe(false);
    });

    it('should identify boostable types', () => {
      expect(isBoostable('Note')).toBe(true);
      expect(isBoostable('Article')).toBe(true);
      expect(isBoostable('Event')).toBe(false);
    });
  });
});
