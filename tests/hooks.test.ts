/**
 * Content hooks tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureActivityPub, resetActivityPubConfig } from '../src/config.js';
import {
  mapVisibility,
  getActivityStreamsType,
  buildObjectId,
  type FederatedVisibility
} from '../src/hooks/index.js';

describe('Content Hooks', () => {
  beforeEach(() => {
    resetActivityPubConfig();
    configureActivityPub({ siteBaseUrl: 'https://example.com' });
  });

  describe('mapVisibility', () => {
    const cases: [string, FederatedVisibility][] = [
      ['public', 'public'],
      ['unlisted', 'unlisted'],
      ['followers', 'followers'],
      ['private', 'private'],
      ['unknown', 'public'],
      ['', 'public']
    ];

    it.each(cases)('should map "%s" to "%s"', (input, expected) => {
      expect(mapVisibility(input)).toBe(expected);
    });
  });

  describe('getActivityStreamsType', () => {
    const cases: [string, string][] = [
      ['blog-post', 'Article'],
      ['note', 'Note'],
      ['product', 'Object'],
      ['event', 'Event'],
      ['image', 'Image'],
      ['video', 'Video'],
      ['document', 'Document'],
      ['profile', 'Profile'],
      ['custom', 'Object']
    ];

    it.each(cases)('should map "%s" to "%s"', (input, expected) => {
      expect(getActivityStreamsType(input)).toBe(expected);
    });
  });

  describe('buildObjectId', () => {
    const cases: [string, string, string][] = [
      ['blog-post', 'blog', 'my-post'],
      ['note', 'notes', 'my-note'],
      ['product', 'products', 'my-product'],
      ['event', 'events', 'my-event'],
      ['image', 'images', 'my-image'],
      ['video', 'videos', 'my-video'],
      ['document', 'docs', 'my-doc']
    ];

    it.each(cases)('should map type "%s" to path "%s"', (contentType, expectedPath, slug) => {
      const id = buildObjectId('https://example.com', 'alice', contentType, slug);
      expect(id).toBe(`https://example.com/@alice/${expectedPath}/${slug}`);
    });
  });
});
