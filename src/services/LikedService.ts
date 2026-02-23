





import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { getActorUri, getActivityPubDir } from '../config.js';
import { queueForDelivery } from './ActivityDeliveryService.js';
import type { Like, Undo } from '../types/activitystreams.js';





export interface OutgoingLike {
  id: string;
  activityId: string;
  objectUri: string;
  objectType?: string;
  likedAt: string;
}





function getOutgoingLikesDir(): string {
  return join(getActivityPubDir(), 'outgoing-likes');
}

function ensureOutgoingLikesDir(): void {
  const dir = getOutgoingLikesDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}








export async function likeObject(
  actorHandle: string,
  objectUri: string,
  objectType?: string
): Promise<OutgoingLike> {
  const actorUri = getActorUri(actorHandle);
  const activityId = `${actorUri}/activities/${crypto.randomUUID()}`;
  const likedAt = new Date().toISOString();

  
  const like: OutgoingLike = {
    id: crypto.randomUUID(),
    activityId,
    objectUri,
    objectType,
    likedAt
  };

  
  const likesPath = getLikesPath(actorHandle);
  let likes: OutgoingLike[] = [];

  ensureOutgoingLikesDir();

  if (existsSync(likesPath)) {
    try {
      const content = readFileSync(likesPath, 'utf-8');
      likes = JSON.parse(content);
    } catch (error) {
      console.error(`[LikedService] Failed to load likes for ${actorHandle}:`, error);
    }
  }

  
  if (likes.some(l => l.objectUri === objectUri)) {
    console.log(`[LikedService] Already liked ${objectUri}`);
    return likes.find(l => l.objectUri === objectUri)!;
  }

  likes.unshift(like);
  writeFileSync(likesPath, JSON.stringify(likes, null, 2), 'utf-8');

  
  const likeActivity: Like = {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1'
    ],
    id: activityId,
    type: 'Like',
    actor: actorUri,
    object: objectUri,
    published: likedAt,
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${actorUri}/followers`]
  };

  
  try {
    const objectUrl = new URL(objectUri);
    const inboxUrl = `${objectUrl.origin}/inbox`;
    await queueForDelivery(likeActivity, [inboxUrl]);
    console.log(`[LikedService] Like delivered for ${objectUri}`);
  } catch (error) {
    console.error(`[LikedService] Failed to deliver Like:`, error);
  }

  return like;
}




export async function unlikeObject(
  actorHandle: string,
  objectUri: string
): Promise<void> {
  const actorUri = getActorUri(actorHandle);
  const likesPath = getLikesPath(actorHandle);

  if (!existsSync(likesPath)) {
    return;
  }

  try {
    const content = readFileSync(likesPath, 'utf-8');
    const likes: OutgoingLike[] = JSON.parse(content);

    const likeToRemove = likes.find(l => l.objectUri === objectUri);
    if (!likeToRemove) {
      console.log(`[LikedService] Like not found for ${objectUri}`);
      return;
    }

    
    const filteredLikes = likes.filter(l => l.objectUri !== objectUri);
    writeFileSync(likesPath, JSON.stringify(filteredLikes, null, 2), 'utf-8');

    
    const undoActivity: Undo = {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1'
      ],
      id: `${actorUri}/activities/${crypto.randomUUID()}`,
      type: 'Undo',
      actor: actorUri,
      object: {
        id: likeToRemove.activityId,
        type: 'Like',
        actor: actorUri,
        object: objectUri
      },
      published: new Date().toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${actorUri}/followers`]
    };

    
    try {
      const objectUrl = new URL(objectUri);
      const inboxUrl = `${objectUrl.origin}/inbox`;
      await queueForDelivery(undoActivity, [inboxUrl]);
      console.log(`[LikedService] Undo Like delivered for ${objectUri}`);
    } catch (error) {
      console.error(`[LikedService] Failed to deliver Undo Like:`, error);
    }
  } catch (error) {
    console.error(`[LikedService] Failed to unlike:`, error);
  }
}




export function getOutgoingLikes(actorHandle: string): OutgoingLike[] {
  const likesPath = getLikesPath(actorHandle);

  if (!existsSync(likesPath)) {
    return [];
  }

  try {
    const content = readFileSync(likesPath, 'utf-8');
    return JSON.parse(content) as OutgoingLike[];
  } catch (error) {
    console.error(`[LikedService] Failed to get likes:`, error);
    return [];
  }
}




export function getOutgoingLikeCount(actorHandle: string): number {
  return getOutgoingLikes(actorHandle).length;
}




export function hasLiked(actorHandle: string, objectUri: string): boolean {
  const likes = getOutgoingLikes(actorHandle);
  return likes.some(l => l.objectUri === objectUri);
}





function getLikesPath(actorHandle: string): string {
  return join(getOutgoingLikesDir(), `${actorHandle}.json`);
}
