/**
 * Service tests (unit tests that don't require filesystem)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureActivityPub, resetActivityPubConfig } from '../src/config.js';
import {
  FederationError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  DeliveryError,
  SignatureVerificationError
} from '../src/errors.js';

// UI types
import {
  getVisibilityConfig,
  type ActivityPubStats,
  type EngagementActionResponse,
  type FederationStatus,
  type ContentVisibility
} from '../src/ui/index.js';

// Hooks utilities
import {
  mapVisibility,
  getActivityStreamsType,
  buildObjectId,
  type FederatedVisibility
} from '../src/hooks/index.js';

describe('Error Classes', () => {
  it('should create FederationError with defaults', () => {
    const error = new FederationError('test error');
    expect(error.message).toBe('test error');
    expect(error.code).toBe(500);
    expect(error.name).toBe('FederationError');
    expect(error).toBeInstanceOf(Error);
  });

  it('should create NotFoundError', () => {
    const error = new NotFoundError('not found');
    expect(error.code).toBe(404);
    expect(error.name).toBe('NotFoundError');
    expect(error).toBeInstanceOf(FederationError);
  });

  it('should create UnauthorizedError', () => {
    const error = new UnauthorizedError('unauthorized');
    expect(error.code).toBe(401);
    expect(error).toBeInstanceOf(FederationError);
  });

  it('should create BadRequestError', () => {
    const error = new BadRequestError('bad request');
    expect(error.code).toBe(400);
    expect(error).toBeInstanceOf(FederationError);
  });

  it('should create DeliveryError', () => {
    const error = new DeliveryError('delivery failed', 'https://example.com/@bob');
    expect(error.code).toBe(502);
    expect(error.recipientUri).toBe('https://example.com/@bob');
    expect(error).toBeInstanceOf(FederationError);
  });

  it('should create SignatureVerificationError', () => {
    const error = new SignatureVerificationError('bad sig');
    expect(error.code).toBe(403);
    expect(error).toBeInstanceOf(FederationError);
  });
});

describe('UI Types', () => {
  describe('getVisibilityConfig', () => {
    it('should return config for public visibility', () => {
      const config = getVisibilityConfig('public');
      expect(config.label).toBe('Public');
      expect(config.icon).toBe('lucide:globe');
    });

    it('should return config for private visibility', () => {
      const config = getVisibilityConfig('private');
      expect(config.label).toBe('Private');
      expect(config.icon).toBe('lucide:lock');
    });

    it('should return config for followers visibility', () => {
      const config = getVisibilityConfig('followers');
      expect(config.label).toBe('Followers Only');
    });

    it('should return config for unlisted visibility', () => {
      const config = getVisibilityConfig('unlisted');
      expect(config.label).toBe('Unlisted');
    });

    it('should return config for direct visibility', () => {
      const config = getVisibilityConfig('direct');
      expect(config.label).toBe('Direct');
    });

    it('should fallback to public for unknown visibility', () => {
      const config = getVisibilityConfig('unknown' as ContentVisibility);
      expect(config.label).toBe('Public');
    });
  });
});

describe('Hooks Utilities', () => {
  describe('mapVisibility', () => {
    it('should map public visibility', () => {
      expect(mapVisibility('public')).toBe('public');
    });

    it('should map unlisted visibility', () => {
      expect(mapVisibility('unlisted')).toBe('unlisted');
    });

    it('should map followers visibility', () => {
      expect(mapVisibility('followers')).toBe('followers');
    });

    it('should map private visibility', () => {
      expect(mapVisibility('private')).toBe('private');
    });

    it('should default to public for unknown', () => {
      expect(mapVisibility('unknown')).toBe('public');
    });
  });

  describe('getActivityStreamsType', () => {
    it('should map blog-post to Article', () => {
      expect(getActivityStreamsType('blog-post')).toBe('Article');
    });

    it('should map note to Note', () => {
      expect(getActivityStreamsType('note')).toBe('Note');
    });

    it('should map event to Event', () => {
      expect(getActivityStreamsType('event')).toBe('Event');
    });

    it('should map image to Image', () => {
      expect(getActivityStreamsType('image')).toBe('Image');
    });

    it('should default to Object for unknown', () => {
      expect(getActivityStreamsType('unknown')).toBe('Object');
    });
  });

  describe('buildObjectId', () => {
    it('should build blog post object ID', () => {
      const id = buildObjectId('https://example.com', 'alice', 'blog-post', 'my-post');
      expect(id).toBe('https://example.com/@alice/blog/my-post');
    });

    it('should build note object ID', () => {
      const id = buildObjectId('https://example.com', 'alice', 'note', 'my-note');
      expect(id).toBe('https://example.com/@alice/notes/my-note');
    });

    it('should build product object ID', () => {
      const id = buildObjectId('https://example.com', 'alice', 'product', 'my-product');
      expect(id).toBe('https://example.com/@alice/products/my-product');
    });

    it('should use content path for unknown types', () => {
      const id = buildObjectId('https://example.com', 'alice', 'unknown', 'test');
      expect(id).toBe('https://example.com/@alice/content/test');
    });
  });
});

describe('WebFinger (parseResource)', () => {
  beforeEach(() => {
    resetActivityPubConfig();
    configureActivityPub({ siteBaseUrl: 'https://example.com' });
  });

  it('should parse acct: resource', async () => {
    const { parseResource } = await import('../src/services/WebFingerService.js');
    const result = parseResource('acct:alice@example.com');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('acct');
    expect(result!.handle).toBe('alice');
    expect(result!.domain).toBe('example.com');
  });

  it('should parse URL resource', async () => {
    const { parseResource } = await import('../src/services/WebFingerService.js');
    const result = parseResource('https://example.com/@alice');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('url');
    expect(result!.handle).toBe('alice');
  });

  it('should return null for invalid resource', async () => {
    const { parseResource } = await import('../src/services/WebFingerService.js');
    expect(parseResource('invalid')).toBeNull();
    expect(parseResource('')).toBeNull();
  });
});

describe('WebFinger (validateWebFingerQuery)', () => {
  beforeEach(() => {
    resetActivityPubConfig();
    configureActivityPub({ siteBaseUrl: 'https://example.com' });
  });

  it('should validate correct query', async () => {
    const { validateWebFingerQuery } = await import('../src/services/WebFingerService.js');
    const params = new URLSearchParams({ resource: 'acct:alice@example.com' });
    const result = validateWebFingerQuery(params);
    expect(result.valid).toBe(true);
    expect(result.resource).toBe('acct:alice@example.com');
  });

  it('should reject missing resource', async () => {
    const { validateWebFingerQuery } = await import('../src/services/WebFingerService.js');
    const params = new URLSearchParams({});
    const result = validateWebFingerQuery(params);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing');
  });

  it('should reject wrong domain', async () => {
    const { validateWebFingerQuery } = await import('../src/services/WebFingerService.js');
    const params = new URLSearchParams({ resource: 'acct:alice@other.com' });
    const result = validateWebFingerQuery(params);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('domain');
  });
});

describe('Activity Utilities', () => {
  it('should validate activity types', async () => {
    const { isActivityType, validateActivity } = await import('../src/utils/activity.js');
    expect(isActivityType('Create')).toBe(true);
    expect(isActivityType('Follow')).toBe(true);
    expect(isActivityType('Invalid')).toBe(false);
  });
});
