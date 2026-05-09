import { describe, expect, it, beforeEach } from 'vitest';
import { configureActivityPub, resetActivityPubConfig } from '../src/config.js';
import {
  buildBrandActorUris,
  createBrandActor,
  createBrandWebFinger,
  normalizeBrandSlug,
  validateBrandActor,
} from '../src/services/BrandActorService.js';

const PUBLIC_KEY = [
  '-----BEGIN PUBLIC KEY-----',
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtest',
  '-----END PUBLIC KEY-----',
].join('\n');

describe('BrandActorService', () => {
  beforeEach(() => {
    resetActivityPubConfig();
    configureActivityPub({ siteBaseUrl: 'https://tinyland.dev' });
  });

  it('normalizes supported brand actor slugs', () => {
    expect(normalizeBrandSlug(' Software-Tinyland-Dev ')).toBe('software-tinyland-dev');
    expect(normalizeBrandSlug('gear-tinyland-dev')).toBe('gear-tinyland-dev');
  });

  it('rejects invalid brand actor slugs', () => {
    expect(() => normalizeBrandSlug('software.tinyland.dev')).toThrow(/Invalid brand actor slug/);
    expect(() => normalizeBrandSlug('-gear')).toThrow(/Invalid brand actor slug/);
    expect(() => normalizeBrandSlug('gear-')).toThrow(/Invalid brand actor slug/);
  });

  it('derives stable brand actor URIs from the configured instance', () => {
    const uris = buildBrandActorUris('software-tinyland-dev');

    expect(uris).toEqual({
      logicalActorRef: 'brand:software-tinyland-dev',
      actorId: 'https://tinyland.dev/ap/actors/brand/software-tinyland-dev',
      publicKeyId: 'https://tinyland.dev/ap/actors/brand/software-tinyland-dev#main-key',
      inbox: 'https://tinyland.dev/ap/actors/brand/software-tinyland-dev/inbox',
      outbox: 'https://tinyland.dev/ap/actors/brand/software-tinyland-dev/outbox',
      following: 'https://tinyland.dev/ap/actors/brand/software-tinyland-dev/following',
      followers: 'https://tinyland.dev/ap/actors/brand/software-tinyland-dev/followers',
      liked: 'https://tinyland.dev/ap/actors/brand/software-tinyland-dev/liked',
      featured: 'https://tinyland.dev/ap/actors/brand/software-tinyland-dev/featured',
      webFingerResource: 'acct:software-tinyland-dev@tinyland.dev',
    });
  });

  it('builds a brand actor document without using user handle routes', () => {
    const actor = createBrandActor({
      slug: 'gear-tinyland-dev',
      name: 'Gear.tinyland.dev',
      summary: 'Inquiry-first used equipment records.',
      url: 'https://gear.tinyland.dev',
      publicKeyPem: PUBLIC_KEY,
      published: '2026-05-10T00:00:00.000Z',
    });

    expect(actor.id).toBe('https://tinyland.dev/ap/actors/brand/gear-tinyland-dev');
    expect(actor.id).not.toContain('/@');
    expect(actor.type).toBe('Service');
    expect(actor.preferredUsername).toBe('gear-tinyland-dev');
    expect(actor.manuallyApprovesFollowers).toBe(true);
    expect(actor.publicKey).toEqual({
      id: 'https://tinyland.dev/ap/actors/brand/gear-tinyland-dev#main-key',
      owner: 'https://tinyland.dev/ap/actors/brand/gear-tinyland-dev',
      publicKeyPem: PUBLIC_KEY,
    });
    expect(actor.endpoints?.sharedInbox).toBe('https://tinyland.dev/inbox');
  });

  it('builds WebFinger for a brand actor', () => {
    const actor = createBrandActor({
      slug: 'software-tinyland-dev',
      name: 'Software.tinyland.dev',
      url: 'https://software.tinyland.dev',
      publicKeyPem: PUBLIC_KEY,
    });

    const webFinger = createBrandWebFinger(actor);
    expect(webFinger.subject).toBe('acct:software-tinyland-dev@tinyland.dev');
    expect(webFinger.aliases).toEqual([
      'https://tinyland.dev/ap/actors/brand/software-tinyland-dev',
      'https://software.tinyland.dev',
    ]);
    expect(webFinger.links[0]).toEqual({
      rel: 'self',
      type: 'application/activity+json',
      href: 'https://tinyland.dev/ap/actors/brand/software-tinyland-dev',
    });
  });

  it('validates actor documents against the derived URI contract', () => {
    const actor = createBrandActor({
      slug: 'software-tinyland-dev',
      name: 'Software.tinyland.dev',
      publicKeyPem: PUBLIC_KEY,
    });

    expect(validateBrandActor(actor, 'software-tinyland-dev')).toEqual({
      valid: true,
      errors: [],
    });

    expect(validateBrandActor({ ...actor, inbox: `${actor.id}/wrong` }, 'software-tinyland-dev')).toEqual({
      valid: false,
      errors: ['inbox must be https://tinyland.dev/ap/actors/brand/software-tinyland-dev/inbox'],
    });
  });
});
