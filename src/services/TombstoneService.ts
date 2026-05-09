import type { Activity, ASObject, Tombstone } from '../types/activitystreams.js';

export interface CreateTombstoneInput {
  id: string;
  formerType: string;
  deleted?: string;
}

export interface CreateTombstoneDeleteActivityInput extends CreateTombstoneInput {
  activityId: string;
  actor: string;
  to: string[];
  cc?: string[];
  published?: string;
}

export interface TombstoneDeleteValidationResult {
  valid: boolean;
  errors: string[];
}

const ACTIVITY_STREAMS_CONTEXT = 'https://www.w3.org/ns/activitystreams';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIsoDateString(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function createTombstone(input: CreateTombstoneInput): Tombstone {
  const deleted = input.deleted ?? new Date().toISOString();

  return {
    id: input.id,
    type: 'Tombstone',
    formerType: input.formerType,
    deleted,
  };
}

export function createTombstoneDeleteActivity(input: CreateTombstoneDeleteActivityInput): Activity {
  const published = input.published ?? input.deleted ?? new Date().toISOString();

  return {
    '@context': ACTIVITY_STREAMS_CONTEXT,
    id: input.activityId,
    type: 'Delete',
    actor: input.actor,
    object: createTombstone(input),
    published,
    to: input.to,
    cc: input.cc ?? [],
  };
}

export function isTombstoneDeleteActivity(activity: Activity): boolean {
  if (activity.type !== 'Delete') {
    return false;
  }

  const object = activity.object;

  return isRecord(object) && object.type === 'Tombstone';
}

export function validateTombstoneDeleteActivity(activity: Activity): TombstoneDeleteValidationResult {
  const errors: string[] = [];

  if (activity.type !== 'Delete') {
    errors.push('activity type must be Delete');
  }

  if (typeof activity.actor !== 'string' || activity.actor.length === 0) {
    errors.push('actor must be a non-empty string');
  }

  const object = activity.object;

  if (!isRecord(object)) {
    errors.push('object must be an embedded Tombstone object');
    return { valid: false, errors };
  }

  const tombstone = object as ASObject & Partial<Tombstone>;

  if (tombstone.type !== 'Tombstone') {
    errors.push('object type must be Tombstone');
  }

  if (typeof tombstone.id !== 'string' || tombstone.id.length === 0) {
    errors.push('tombstone id must be a non-empty string');
  }

  if (typeof tombstone.formerType !== 'string' || tombstone.formerType.length === 0) {
    errors.push('tombstone formerType must be a non-empty string');
  }

  if (typeof tombstone.deleted !== 'string' || !isIsoDateString(tombstone.deleted)) {
    errors.push('tombstone deleted must be an ISO date string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
