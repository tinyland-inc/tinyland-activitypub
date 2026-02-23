



import { describe, it, expect } from 'vitest';
import type {
  ASObject,
  ASLink,
  Activity,
  Collection,
  OrderedCollection,
  Note,
  Article,
  Image,
  Video,
  Document,
  Follow,
  Accept,
  Reject,
  Like,
  Announce,
  Undo,
  Create,
  Update,
  Delete,
  Tombstone,
  Group,
  Actor as ActorType
} from '../src/types/activitystreams.js';
import type {
  Actor,
  ActorImage,
  ActorPublicKey,
  ActorPropertyValue
} from '../src/types/actor.js';
import { isActor, isActorOfType } from '../src/types/actor.js';
import type {
  BaseContent,
  BlogPost,
  ContentNote,
  Product,
  Profile,
  ContentEvent,
  ContentImage,
  ContentVideo,
  ContentDocument,
  Visibility
} from '../src/types/content.js';

describe('Type Definitions', () => {
  describe('ActivityStreams types', () => {
    it('should allow creating ASObject', () => {
      const obj: ASObject = {
        id: 'https://example.com/objects/1',
        type: 'Note',
        content: 'Hello, World!'
      };
      expect(obj.type).toBe('Note');
    });

    it('should allow creating Activity', () => {
      const activity: Activity = {
        id: 'https://example.com/activities/1',
        type: 'Create',
        actor: 'https://example.com/@alice',
        object: {
          id: 'https://example.com/notes/1',
          type: 'Note',
          content: 'Hello!'
        }
      };
      expect(activity.type).toBe('Create');
    });

    it('should allow creating OrderedCollection', () => {
      const collection: OrderedCollection = {
        id: 'https://example.com/outbox',
        type: 'OrderedCollection',
        totalItems: 0,
        orderedItems: []
      };
      expect(collection.type).toBe('OrderedCollection');
    });

    it('should allow creating Tombstone', () => {
      const tombstone: Tombstone = {
        id: 'https://example.com/notes/1',
        type: 'Tombstone',
        formerType: 'Note',
        deleted: new Date().toISOString()
      };
      expect(tombstone.type).toBe('Tombstone');
    });
  });

  describe('Actor types', () => {
    it('should allow creating Actor', () => {
      const actor: Actor = {
        '@context': ['https://www.w3.org/ns/activitystreams'],
        id: 'https://example.com/@alice',
        type: 'Person',
        preferredUsername: 'alice',
        inbox: 'https://example.com/@alice/inbox',
        outbox: 'https://example.com/@alice/outbox',
        name: 'Alice',
        summary: 'A test user',
        publicKey: {
          id: 'https://example.com/@alice#main-key',
          owner: 'https://example.com/@alice',
          publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----'
        }
      };
      expect(actor.preferredUsername).toBe('alice');
    });

    it('should validate actor with isActor', () => {
      const validActor = {
        id: 'https://example.com/@alice',
        type: 'Person',
        preferredUsername: 'alice',
        inbox: 'https://example.com/@alice/inbox',
        outbox: 'https://example.com/@alice/outbox'
      };
      expect(isActor(validActor)).toBe(true);
    });

    it('should reject non-actor objects', () => {
      expect(isActor(null)).toBe(false);
      expect(isActor({})).toBe(false);
      expect(isActor({ type: 'Note' })).toBe(false);
    });

    it('should check actor type', () => {
      const actor = {
        id: 'https://example.com/@alice',
        type: 'Person',
        preferredUsername: 'alice',
        inbox: 'https://example.com/@alice/inbox',
        outbox: 'https://example.com/@alice/outbox'
      };
      expect(isActorOfType(actor, 'Person')).toBe(true);
      expect(isActorOfType(actor, 'Service')).toBe(false);
    });
  });

  describe('Content types', () => {
    it('should allow creating BlogPost', () => {
      const post: BlogPost = {
        type: 'blog-post',
        slug: 'test-post',
        title: 'Test Post',
        content: 'Hello, World!',
        tags: ['test'],
        visibility: 'public',
        publishedAt: new Date().toISOString()
      };
      expect(post.type).toBe('blog-post');
    });

    it('should allow creating ContentNote', () => {
      const note: ContentNote = {
        type: 'note',
        slug: 'test-note',
        content: 'A short note',
        tags: [],
        visibility: 'public',
        publishedAt: new Date().toISOString()
      };
      expect(note.type).toBe('note');
    });

    it('should allow visibility values', () => {
      const vis: Visibility[] = ['public', 'unlisted', 'followers', 'private'];
      expect(vis).toHaveLength(4);
    });
  });
});
