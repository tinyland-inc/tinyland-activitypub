



import { describe, it, expect, beforeEach } from 'vitest';
import { configureActivityPub, resetActivityPubConfig } from '../src/config.js';
import {
  contentToActivityPubObject,
  generateActivityPubId,
  generateActivityId,
  wrapInCreateActivity,
  wrapInUpdateActivity,
  createDeleteActivity,
  shouldFederateContent,
  getFederationVisibility,
  isPubliclyDiscoverable,
  getAddressingForVisibility,
  batchContentToActivityPub,
  type FederableContent,
  type FederationObject
} from '../src/federation/index.js';

describe('Content Federation', () => {
  const baseUrl = 'https://example.com';

  beforeEach(() => {
    resetActivityPubConfig();
    configureActivityPub({ siteBaseUrl: baseUrl });
  });

  const makeBlogContent = (overrides?: Partial<FederableContent>): FederableContent => ({
    slug: 'test-post',
    type: 'blog',
    content: '# Test Post\n\nHello, World!',
    visibility: 'public',
    publishedAt: '2024-01-01T00:00:00Z',
    authorHandle: 'alice',
    frontmatter: {
      title: 'Test Post',
      excerpt: 'A test blog post',
      tags: ['test', 'blog']
    },
    ...overrides
  });

  const makeNoteContent = (overrides?: Partial<FederableContent>): FederableContent => ({
    slug: 'test-note',
    type: 'note',
    content: 'Hello, fediverse!',
    visibility: 'public',
    publishedAt: '2024-01-01T00:00:00Z',
    authorHandle: 'alice',
    frontmatter: {
      hashtags: ['fediverse']
    },
    ...overrides
  });

  describe('generateActivityPubId', () => {
    it('should generate ID for blog content', () => {
      const content = makeBlogContent();
      const id = generateActivityPubId(content, baseUrl);
      expect(id).toContain('example.com');
      expect(id).toContain('test-post');
    });

    it('should generate ID for note content', () => {
      const content = makeNoteContent();
      const id = generateActivityPubId(content, baseUrl);
      expect(id).toContain('test-note');
    });
  });

  describe('generateActivityId', () => {
    it('should generate activity ID with type', () => {
      const content = makeBlogContent();
      const id = generateActivityId(content, 'Create', baseUrl);
      expect(id).toContain('create');
      expect(id).toContain('test-post');
    });
  });

  describe('contentToActivityPubObject', () => {
    it('should convert blog to Article', () => {
      const content = makeBlogContent();
      const obj = contentToActivityPubObject(content, baseUrl);
      expect(obj.type).toBe('Article');
      expect(obj.name).toBe('Test Post');
      expect(obj.summary).toBe('A test blog post');
      expect(obj.content).toBe('# Test Post\n\nHello, World!');
    });

    it('should convert note to Note', () => {
      const content = makeNoteContent();
      const obj = contentToActivityPubObject(content, baseUrl);
      expect(obj.type).toBe('Note');
      expect(obj.content).toBe('Hello, fediverse!');
    });

    it('should set public addressing for public content', () => {
      const content = makeBlogContent({ visibility: 'public' });
      const obj = contentToActivityPubObject(content, baseUrl);
      expect(obj.to).toContain('https://www.w3.org/ns/activitystreams#Public');
    });

    it('should set followers addressing for followers-only content', () => {
      const content = makeBlogContent({ visibility: 'followers' });
      const obj = contentToActivityPubObject(content, baseUrl);
      expect(obj.to).not.toContain('https://www.w3.org/ns/activitystreams#Public');
      expect(obj.to![0]).toContain('/followers');
    });

    it('should convert event content', () => {
      const content: FederableContent = {
        slug: 'test-event',
        type: 'event',
        content: 'An event',
        visibility: 'public',
        publishedAt: '2024-01-01T00:00:00Z',
        authorHandle: 'alice',
        frontmatter: {
          title: 'Test Event',
          startDateTime: '2024-06-01T10:00:00Z',
          endDateTime: '2024-06-01T12:00:00Z',
          location: 'Online'
        }
      };
      const obj = contentToActivityPubObject(content, baseUrl);
      expect(obj.type).toBe('Event');
      expect(obj.startTime).toBe('2024-06-01T10:00:00Z');
      expect(obj.location).toEqual({ type: 'Place', name: 'Online' });
    });

    it('should convert video content', () => {
      const content: FederableContent = {
        slug: 'test-video',
        type: 'video',
        content: 'A video',
        visibility: 'public',
        publishedAt: '2024-01-01T00:00:00Z',
        authorHandle: 'alice',
        frontmatter: {
          title: 'Test Video',
          url: 'https://example.com/video.mp4',
          width: 1920,
          height: 1080,
          duration: 'PT5M30S'
        }
      };
      const obj = contentToActivityPubObject(content, baseUrl);
      expect(obj.type).toBe('Video');
      expect(obj.width).toBe(1920);
      expect(obj.height).toBe(1080);
    });

    it('should convert profile content', () => {
      const content: FederableContent = {
        slug: 'alice',
        type: 'profile',
        content: 'Hello, I am Alice.',
        visibility: 'public',
        publishedAt: '2024-01-01T00:00:00Z',
        authorHandle: 'alice',
        frontmatter: {
          name: 'Alice',
          bio: 'A test user',
          avatar: 'https://example.com/avatar.jpg'
        }
      };
      const obj = contentToActivityPubObject(content, baseUrl);
      expect(obj.type).toBe('Person');
      expect(obj.preferredUsername).toBe('alice');
      expect(obj.inbox).toContain('/inbox');
    });
  });

  describe('wrapInCreateActivity', () => {
    it('should wrap content in Create activity', () => {
      const content = makeBlogContent();
      const activity = wrapInCreateActivity(content, baseUrl);
      expect(activity.type).toBe('Create');
      expect(activity.actor).toContain('alice');
      expect(activity.object).toBeDefined();
    });
  });

  describe('wrapInUpdateActivity', () => {
    it('should wrap content in Update activity', () => {
      const content = makeBlogContent({ updatedAt: '2024-02-01T00:00:00Z' });
      const activity = wrapInUpdateActivity(content, baseUrl);
      expect(activity.type).toBe('Update');
      expect(activity.published).toBe('2024-02-01T00:00:00Z');
    });
  });

  describe('createDeleteActivity', () => {
    it('should create Delete activity with Tombstone', () => {
      const content = makeBlogContent();
      const activity = createDeleteActivity(content, baseUrl);
      expect(activity.type).toBe('Delete');
      expect(activity.object).toBeDefined();
      
      expect((activity.object as any).type).toBe('Tombstone');
    });
  });

  describe('shouldFederateContent', () => {
    it('should federate public content', () => {
      expect(shouldFederateContent(makeBlogContent())).toBe(true);
    });

    it('should not federate private content', () => {
      expect(shouldFederateContent(makeBlogContent({ visibility: 'private' }))).toBe(false);
    });

    it('should not federate content with noFederate flag', () => {
      expect(shouldFederateContent(makeBlogContent({
        frontmatter: { noFederate: true }
      }))).toBe(false);
    });

    it('should federate profiles regardless of other rules', () => {
      const profile: FederableContent = {
        slug: 'alice',
        type: 'profile',
        content: '',
        visibility: 'public',
        publishedAt: '',
        authorHandle: 'alice',
        frontmatter: {}
      };
      expect(shouldFederateContent(profile)).toBe(true);
    });

    it('should not federate content without publishedAt', () => {
      expect(shouldFederateContent(makeBlogContent({ publishedAt: '' }))).toBe(false);
    });
  });

  describe('getAddressingForVisibility', () => {
    it('should return public addressing', () => {
      const result = getAddressingForVisibility('public', 'actor', 'followers');
      expect(result.to).toContain('https://www.w3.org/ns/activitystreams#Public');
    });

    it('should return unlisted addressing', () => {
      const result = getAddressingForVisibility('unlisted', 'actor', 'followers');
      expect(result.to).toContain('followers');
      expect(result.cc).toContain('https://www.w3.org/ns/activitystreams#Public');
    });

    it('should return private addressing', () => {
      const result = getAddressingForVisibility('private', 'actor', 'followers');
      expect(result.to).toContain('actor');
      expect(result.cc).toEqual([]);
    });
  });

  describe('batchContentToActivityPub', () => {
    it('should convert multiple items filtering non-federatable', () => {
      const items = [
        makeBlogContent(),
        makeBlogContent({ visibility: 'private', slug: 'private-post' }),
        makeNoteContent()
      ];
      const results = batchContentToActivityPub(items, baseUrl);
      expect(results).toHaveLength(2);
    });
  });
});
