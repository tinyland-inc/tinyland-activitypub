




import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import type { Actor, ActorImage, ActorPublicKey, ActorPropertyValue } from '../types/actor.js';
import { getSiteBaseUrl, getActorsDir } from '../config.js';








export interface ActorUser {
  handle: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
}




export interface ActorProfile {
  bio?: string;
  avatar?: string;
  coverImage?: string;
  website?: string;
  location?: string;
  pronouns?: string;
  email?: string;
  twitter?: string;
  github?: string;
  linkedin?: string;
  mastodon?: string;
  instagram?: string;
  visibility?: string;
}








export interface StoredActor {
  id: string;
  handle: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  website?: string;
  location?: string;
  pronouns?: string;
  email?: string;
  mastodon?: string;
  twitter?: string;
  github?: string;
  linkedin?: string;
  instagram?: string;
  discoverable: boolean;
  indexable: boolean;
  manuallyApprovesFollowers: boolean;
  publicKeyId: string;
  publicKeyPem: string;
  privateKeyPem: string;
  actorType: 'Person' | 'Organization' | 'Service';
  visibility: 'public' | 'unlisted' | 'followers' | 'private';
  createdAt: string;
  updatedAt: string;
}





function ensureActorsDir(): void {
  const dir = getActorsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}








export function generateKeyPair(): {
  publicKeyId: string;
  publicKeyPem: string;
  privateKeyPem: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  const actorId = crypto.randomUUID();
  const publicKeyId = `${getSiteBaseUrl()}/@${actorId}#main-key`;

  return {
    publicKeyId,
    publicKeyPem: publicKey,
    privateKeyPem: privateKey
  };
}




export function createActorFromUser(user: ActorUser, profile?: ActorProfile): Actor {
  const baseUrl = getSiteBaseUrl();
  const actorId = `${baseUrl}/@${user.handle}`;

  
  let keyPair: {
    publicKeyId: string;
    publicKeyPem: string;
    privateKeyPem: string;
  };

  const storedActor = getStoredActor(user.handle);

  if (storedActor) {
    keyPair = {
      publicKeyId: storedActor.publicKeyId,
      publicKeyPem: storedActor.publicKeyPem,
      privateKeyPem: storedActor.privateKeyPem
    };
  } else {
    keyPair = generateKeyPair();
  }

  
  const attachments: ActorPropertyValue[] = [];

  if (profile?.website) {
    attachments.push({
      type: 'PropertyValue',
      name: 'Website',
      value: `<a href="${profile.website}" rel="me nofollow noreferrer" target="_blank">${profile.website}</a>`
    });
  }

  if (profile?.twitter) {
    attachments.push({
      type: 'PropertyValue',
      name: 'Twitter',
      value: `<a href="https://twitter.com/${profile.twitter.replace('@', '')}" rel="me nofollow noreferrer" target="_blank">${profile.twitter}</a>`
    });
  }

  if (profile?.github) {
    attachments.push({
      type: 'PropertyValue',
      name: 'GitHub',
      value: `<a href="https://github.com/${profile.github.replace('@', '')}" rel="me nofollow noreferrer" target="_blank">${profile.github}</a>`
    });
  }

  if (profile?.linkedin) {
    attachments.push({
      type: 'PropertyValue',
      name: 'LinkedIn',
      value: `<a href="https://linkedin.com/in/${profile.linkedin}" rel="me nofollow noreferrer" target="_blank">${profile.linkedin}</a>`
    });
  }

  if (profile?.mastodon) {
    attachments.push({
      type: 'PropertyValue',
      name: 'Mastodon',
      value: `<a href="${profile.mastodon}" rel="me nofollow noreferrer" target="_blank">Fediverse</a>`
    });
  }

  
  const icon: ActorImage | undefined = profile?.avatar ? {
    type: 'Image',
    url: `${baseUrl}${profile.avatar}`,
    mediaType: 'image/jpeg'
  } : undefined;

  
  const image: ActorImage | undefined = profile?.coverImage ? {
    type: 'Image',
    url: `${baseUrl}${profile.coverImage}`,
    mediaType: 'image/jpeg'
  } : undefined;

  
  const publicKey: ActorPublicKey = {
    id: keyPair.publicKeyId,
    owner: actorId,
    publicKeyPem: keyPair.publicKeyPem
  };

  
  const actor: Actor = {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
      {
        toot: 'http://joinmastodon.org/ns#',
        discoverable: 'toot:discoverable',
        indexable: 'toot:indexable',
        featured: 'toot:featured',
        manuallyApprovesFollowers: 'as:manuallyApprovesFollowers',
        PropertyValue: 'schema:PropertyValue',
        schema: 'http://schema.org/#'
      }
    ],
    id: actorId,
    type: 'Person',
    inbox: `${actorId}/inbox`,
    outbox: `${actorId}/outbox`,
    following: `${actorId}/following`,
    followers: `${actorId}/followers`,
    liked: `${actorId}/liked`,
    featured: `${actorId}/featured`,
    preferredUsername: user.handle,
    name: user.displayName || user.handle,
    summary: profile?.bio || '',
    url: `${baseUrl}/@${user.handle}`,
    icon,
    image,
    discoverable: profile?.visibility !== 'private',
    indexable: profile?.visibility !== 'private',
    manuallyApprovesFollowers: false,
    attachment: attachments.length > 0 ? attachments : undefined,
    publicKey,
    published: user.createdAt,
    updated: user.updatedAt,
    endpoints: {
      sharedInbox: `${baseUrl}/inbox`
    }
  };

  
  storeActor(user.handle, {
    id: actorId,
    handle: user.handle,
    displayName: user.displayName || user.handle,
    bio: profile?.bio || '',
    avatarUrl: profile?.avatar,
    bannerUrl: profile?.coverImage,
    website: profile?.website,
    location: profile?.location,
    pronouns: profile?.pronouns,
    email: profile?.email,
    mastodon: profile?.mastodon,
    twitter: profile?.twitter,
    github: profile?.github,
    linkedin: profile?.linkedin,
    instagram: profile?.instagram,
    discoverable: profile?.visibility !== 'private',
    indexable: profile?.visibility !== 'private',
    manuallyApprovesFollowers: false,
    publicKeyId: keyPair.publicKeyId,
    publicKeyPem: keyPair.publicKeyPem,
    privateKeyPem: keyPair.privateKeyPem,
    actorType: 'Person',
    
    visibility: (profile?.visibility as any) || 'public',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  });

  return actor;
}




export function getActorByHandle(handle: string): Actor | null {
  const storedActor = getStoredActor(handle);
  const baseUrl = getSiteBaseUrl();

  if (!storedActor) {
    return null;
  }

  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
      {
        toot: 'http://joinmastodon.org/ns#',
        discoverable: 'toot:discoverable',
        indexable: 'toot:indexable',
        featured: 'toot:featured'
      }
    ],
    id: storedActor.id,
    type: storedActor.actorType,
    inbox: `${storedActor.id}/inbox`,
    outbox: `${storedActor.id}/outbox`,
    following: `${storedActor.id}/following`,
    followers: `${storedActor.id}/followers`,
    liked: `${storedActor.id}/liked`,
    featured: `${storedActor.id}/featured`,
    preferredUsername: storedActor.handle,
    name: storedActor.displayName || storedActor.handle,
    summary: storedActor.bio || '',
    url: storedActor.id,
    icon: storedActor.avatarUrl ? {
      type: 'Image',
      url: `${baseUrl}${storedActor.avatarUrl}`
    } : undefined,
    image: storedActor.bannerUrl ? {
      type: 'Image',
      url: `${baseUrl}${storedActor.bannerUrl}`
    } : undefined,
    discoverable: storedActor.discoverable,
    indexable: storedActor.indexable,
    manuallyApprovesFollowers: storedActor.manuallyApprovesFollowers,
    publicKey: {
      id: storedActor.publicKeyId,
      owner: storedActor.id,
      publicKeyPem: storedActor.publicKeyPem
    },
    published: storedActor.createdAt,
    updated: storedActor.updatedAt,
    endpoints: {
      sharedInbox: `${baseUrl}/inbox`
    }
  };
}




function getStoredActor(handle: string): StoredActor | null {
  ensureActorsDir();
  const filePath = join(getActorsDir(), `${handle}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as StoredActor;
  } catch (err) {
    console.error(`Failed to load actor ${handle}:`, err);
    return null;
  }
}




function storeActor(handle: string, actor: StoredActor): void {
  ensureActorsDir();
  const filePath = join(getActorsDir(), `${handle}.json`);

  try {
    writeFileSync(filePath, JSON.stringify(actor, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Failed to store actor ${handle}:`, err);
  }
}




export function getActorPrivateKey(handle: string): string | null {
  const storedActor = getStoredActor(handle);
  return storedActor?.privateKeyPem || null;
}




export function deleteActor(handle: string): void {
  ensureActorsDir();
  const filePath = join(getActorsDir(), `${handle}.json`);

  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath);
    } catch (err) {
      console.error(`Failed to delete actor ${handle}:`, err);
    }
  }
}
