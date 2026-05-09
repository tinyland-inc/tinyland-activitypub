import { getInstanceDomain, getSiteBaseUrl } from '../config.js';
import type { Actor, ActorImage, ActorPropertyValue } from '../types/actor.js';
import type { WebFingerResource } from './WebFingerService.js';

const ACTIVITY_STREAMS_CONTEXT = 'https://www.w3.org/ns/activitystreams';
const SECURITY_CONTEXT = 'https://w3id.org/security/v1';

export type BrandActorType = 'Organization' | 'Service' | 'Application';

export interface BrandActorUris {
  logicalActorRef: string;
  actorId: string;
  publicKeyId: string;
  inbox: string;
  outbox: string;
  following: string;
  followers: string;
  liked: string;
  featured: string;
  webFingerResource: string;
}

export interface CreateBrandActorInput {
  slug: string;
  name: string;
  publicKeyPem: string;
  summary?: string;
  url?: string;
  baseUrl?: string;
  actorType?: BrandActorType;
  iconUrl?: string;
  imageUrl?: string;
  attachments?: ActorPropertyValue[];
  published?: string;
  updated?: string;
  discoverable?: boolean;
  indexable?: boolean;
  manuallyApprovesFollowers?: boolean;
  sharedInbox?: string | false;
}

export interface BrandActorValidationResult {
  valid: boolean;
  errors: string[];
}

export function normalizeBrandSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();

  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
    throw new Error(
      'Invalid brand actor slug. Use lowercase letters, numbers, and internal hyphens.'
    );
  }

  return normalized;
}

export function buildBrandActorUris(slug: string, baseUrl?: string): BrandActorUris {
  const normalizedSlug = normalizeBrandSlug(slug);
  const base = normalizeBaseUrl(baseUrl);
  const domain = getDomain(baseUrl);
  const actorId = `${base}/ap/actors/brand/${normalizedSlug}`;

  return {
    logicalActorRef: `brand:${normalizedSlug}`,
    actorId,
    publicKeyId: `${actorId}#main-key`,
    inbox: `${actorId}/inbox`,
    outbox: `${actorId}/outbox`,
    following: `${actorId}/following`,
    followers: `${actorId}/followers`,
    liked: `${actorId}/liked`,
    featured: `${actorId}/featured`,
    webFingerResource: `acct:${normalizedSlug}@${domain}`,
  };
}

export function createBrandActor(input: CreateBrandActorInput): Actor {
  const uris = buildBrandActorUris(input.slug, input.baseUrl);
  const published = input.published ?? new Date(0).toISOString();
  const actorUrl = input.url ?? uris.actorId;
  const sharedInbox = input.sharedInbox === false
    ? undefined
    : input.sharedInbox ?? `${normalizeBaseUrl(input.baseUrl)}/inbox`;

  return {
    '@context': [
      ACTIVITY_STREAMS_CONTEXT,
      SECURITY_CONTEXT,
      {
        toot: 'http://joinmastodon.org/ns#',
        discoverable: 'toot:discoverable',
        indexable: 'toot:indexable',
        featured: 'toot:featured',
        manuallyApprovesFollowers: 'as:manuallyApprovesFollowers',
        PropertyValue: 'schema:PropertyValue',
        schema: 'http://schema.org/#',
      },
    ],
    id: uris.actorId,
    type: input.actorType ?? 'Service',
    inbox: uris.inbox,
    outbox: uris.outbox,
    following: uris.following,
    followers: uris.followers,
    liked: uris.liked,
    featured: uris.featured,
    preferredUsername: normalizeBrandSlug(input.slug),
    name: input.name,
    summary: input.summary ?? '',
    url: actorUrl,
    icon: toActorImage(input.iconUrl),
    image: toActorImage(input.imageUrl),
    discoverable: input.discoverable ?? true,
    indexable: input.indexable ?? true,
    manuallyApprovesFollowers: input.manuallyApprovesFollowers ?? true,
    attachment: input.attachments && input.attachments.length > 0 ? input.attachments : undefined,
    publicKey: {
      id: uris.publicKeyId,
      owner: uris.actorId,
      publicKeyPem: input.publicKeyPem,
    },
    published,
    updated: input.updated,
    endpoints: sharedInbox ? { sharedInbox } : undefined,
  };
}

export function createBrandWebFinger(
  actor: Actor,
  baseUrl?: string
): WebFingerResource {
  const subject = `acct:${actor.preferredUsername}@${getDomain(baseUrl)}`;

  return {
    subject,
    aliases: [actor.id, actor.url ?? actor.id],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actor.id,
      },
      {
        rel: 'http://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: actor.url ?? actor.id,
      },
      {
        rel: 'http://ostatus.org/schema/1.0/subscribe',
        template: `${normalizeBaseUrl(baseUrl)}/authorize_interaction?uri={uri}`,
      },
    ],
  };
}

export function validateBrandActor(actor: Actor, slug: string, baseUrl?: string): BrandActorValidationResult {
  const uris = buildBrandActorUris(slug, baseUrl);
  const errors: string[] = [];

  if (actor.id !== uris.actorId) errors.push(`actor id must be ${uris.actorId}`);
  if (actor.inbox !== uris.inbox) errors.push(`inbox must be ${uris.inbox}`);
  if (actor.outbox !== uris.outbox) errors.push(`outbox must be ${uris.outbox}`);
  if (actor.followers !== uris.followers) errors.push(`followers must be ${uris.followers}`);
  if (actor.publicKey.id !== uris.publicKeyId) {
    errors.push(`public key id must be ${uris.publicKeyId}`);
  }
  if (actor.publicKey.owner !== uris.actorId) {
    errors.push(`public key owner must be ${uris.actorId}`);
  }
  if (actor.preferredUsername !== normalizeBrandSlug(slug)) {
    errors.push(`preferredUsername must be ${normalizeBrandSlug(slug)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeBaseUrl(baseUrl?: string): string {
  return (baseUrl ?? getSiteBaseUrl()).replace(/\/$/, '');
}

function getDomain(baseUrl?: string): string {
  if (!baseUrl) return getInstanceDomain();

  try {
    return new URL(baseUrl).hostname;
  } catch {
    return getInstanceDomain();
  }
}

function toActorImage(url?: string): ActorImage | undefined {
  if (!url) return undefined;
  return {
    type: 'Image',
    url,
  };
}
