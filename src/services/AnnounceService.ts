/**
 * Announce (Boost) Service
 * Manages outgoing announces/boosts (content this actor has boosted)
 * Separate from incoming announces (boosts received on our content)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { getActorUri, getActivityPubDir } from '../config.js';
import { queueForDelivery } from './ActivityDeliveryService.js';
import type { Announce, Undo } from '../types/activitystreams.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface OutgoingAnnounce {
  id: string;
  activityId: string;
  objectUri: string;
  objectType?: string;
  announcedAt: string;
}

// ============================================================================
// Directory Initialization
// ============================================================================

function getOutgoingAnnouncesDir(): string {
  return join(getActivityPubDir(), 'outgoing-announces');
}

function ensureOutgoingAnnouncesDir(): void {
  const dir = getOutgoingAnnouncesDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ============================================================================
// Outgoing Announces Management
// ============================================================================

/**
 * Announce (boost/repost) a remote object
 */
export async function announceObject(
  actorHandle: string,
  objectUri: string,
  objectType?: string
): Promise<OutgoingAnnounce> {
  const actorUri = getActorUri(actorHandle);
  const activityId = `${actorUri}/activities/${crypto.randomUUID()}`;
  const announcedAt = new Date().toISOString();

  // Create announce record
  const announce: OutgoingAnnounce = {
    id: crypto.randomUUID(),
    activityId,
    objectUri,
    objectType,
    announcedAt
  };

  // Save to actor's announces file
  const announcesPath = getAnnouncesPath(actorHandle);
  let announces: OutgoingAnnounce[] = [];

  ensureOutgoingAnnouncesDir();

  if (existsSync(announcesPath)) {
    try {
      const content = readFileSync(announcesPath, 'utf-8');
      announces = JSON.parse(content);
    } catch (error) {
      console.error(`[AnnounceService] Failed to load announces for ${actorHandle}:`, error);
    }
  }

  // Check if already announced
  if (announces.some(a => a.objectUri === objectUri)) {
    console.log(`[AnnounceService] Already announced ${objectUri}`);
    return announces.find(a => a.objectUri === objectUri)!;
  }

  announces.unshift(announce);
  writeFileSync(announcesPath, JSON.stringify(announces, null, 2), 'utf-8');

  // Create and deliver Announce activity
  const announceActivity: Announce = {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1'
    ],
    id: activityId,
    type: 'Announce',
    actor: actorUri,
    object: objectUri,
    published: announcedAt,
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${actorUri}/followers`]
  };

  // Deliver to object's inbox (extract from objectUri)
  try {
    const objectUrl = new URL(objectUri);
    const inboxUrl = `${objectUrl.origin}/inbox`;
    await queueForDelivery(announceActivity, [inboxUrl]);
    console.log(`[AnnounceService] Announce delivered for ${objectUri}`);
  } catch (error) {
    console.error(`[AnnounceService] Failed to deliver Announce:`, error);
  }

  return announce;
}

/**
 * Unannounce (remove boost) a remote object
 */
export async function unannounceObject(
  actorHandle: string,
  objectUri: string
): Promise<void> {
  const actorUri = getActorUri(actorHandle);
  const announcesPath = getAnnouncesPath(actorHandle);

  if (!existsSync(announcesPath)) {
    return;
  }

  try {
    const content = readFileSync(announcesPath, 'utf-8');
    const announces: OutgoingAnnounce[] = JSON.parse(content);

    const announceToRemove = announces.find(a => a.objectUri === objectUri);
    if (!announceToRemove) {
      console.log(`[AnnounceService] Announce not found for ${objectUri}`);
      return;
    }

    // Remove from list
    const filteredAnnounces = announces.filter(a => a.objectUri !== objectUri);
    writeFileSync(announcesPath, JSON.stringify(filteredAnnounces, null, 2), 'utf-8');

    // Create and deliver Undo activity
    const undoActivity: Undo = {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1'
      ],
      id: `${actorUri}/activities/${crypto.randomUUID()}`,
      type: 'Undo',
      actor: actorUri,
      object: {
        id: announceToRemove.activityId,
        type: 'Announce',
        actor: actorUri,
        object: objectUri
      },
      published: new Date().toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${actorUri}/followers`]
    };

    // Deliver to object's inbox
    try {
      const objectUrl = new URL(objectUri);
      const inboxUrl = `${objectUrl.origin}/inbox`;
      await queueForDelivery(undoActivity, [inboxUrl]);
      console.log(`[AnnounceService] Undo Announce delivered for ${objectUri}`);
    } catch (error) {
      console.error(`[AnnounceService] Failed to deliver Undo Announce:`, error);
    }
  } catch (error) {
    console.error(`[AnnounceService] Failed to unannounce:`, error);
  }
}

/**
 * Get all outgoing announces for an actor
 */
export function getOutgoingAnnounces(actorHandle: string): OutgoingAnnounce[] {
  const announcesPath = getAnnouncesPath(actorHandle);

  if (!existsSync(announcesPath)) {
    return [];
  }

  try {
    const content = readFileSync(announcesPath, 'utf-8');
    return JSON.parse(content) as OutgoingAnnounce[];
  } catch (error) {
    console.error(`[AnnounceService] Failed to get announces:`, error);
    return [];
  }
}

/**
 * Get outgoing announce count for an actor
 */
export function getOutgoingAnnounceCount(actorHandle: string): number {
  return getOutgoingAnnounces(actorHandle).length;
}

/**
 * Check if actor has announced an object
 */
export function hasAnnounced(actorHandle: string, objectUri: string): boolean {
  const announces = getOutgoingAnnounces(actorHandle);
  return announces.some(a => a.objectUri === objectUri);
}

// ============================================================================
// Helper Functions
// ============================================================================

function getAnnouncesPath(actorHandle: string): string {
  return join(getOutgoingAnnouncesDir(), `${actorHandle}.json`);
}
