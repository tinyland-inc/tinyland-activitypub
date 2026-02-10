/**
 * Activity Delivery Service
 * Delivers ActivityPub activities to remote servers with HTTP Signatures
 */

import type { Activity } from '../types/activitystreams.js';
import {
  getActivityPubConfig,
  getActorUri,
  getActivityPubDir
} from '../config.js';
import { DeliveryError } from '../errors.js';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  statSync
} from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { createSignedRequest } from './HttpSignatureService.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface DeliveryTask {
  id: string;
  activity: Activity;
  recipients: string[];
  retryCount: number;
  nextRetryAt: number;
  status: 'pending' | 'delivering' | 'delivered' | 'failed';
  error?: string;
  createdAt: number;
}

export interface DeliveryStats {
  total: number;
  pending: number;
  delivering: number;
  delivered: number;
  failed: number;
}

// ============================================================================
// Directory Initialization
// ============================================================================

function getDeliveryQueueDir(): string {
  return join(getActivityPubDir(), 'delivery-queue');
}

function getDeliveryLogsDir(): string {
  return join(getActivityPubDir(), 'delivery-logs');
}

function ensureDeliveryDirs(): void {
  const queueDir = getDeliveryQueueDir();
  const logsDir = getDeliveryLogsDir();
  if (!existsSync(queueDir)) {
    mkdirSync(queueDir, { recursive: true });
  }
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
}

// ============================================================================
// Delivery Queue Management
// ============================================================================

/**
 * Add activity to delivery queue
 * @param activity - ActivityPub activity to deliver
 * @param recipients - List of actor URIs to deliver to
 * @param senderHandle - Local actor handle (for signing)
 */
export async function queueForDelivery(
  activity: Activity,
  recipients: string[],
  senderHandle?: string
): Promise<string> {
  ensureDeliveryDirs();

  const taskId = crypto.randomUUID();
  const task: DeliveryTask = {
    id: taskId,
    activity,
    recipients,
    retryCount: 0,
    nextRetryAt: Date.now(),
    status: 'pending',
    createdAt: Date.now()
  };

  const taskPath = join(getDeliveryQueueDir(), `${taskId}.json`);
  writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf-8');

  // Trigger delivery processing
  processDeliveryQueue(senderHandle).catch(err => {
    console.error('[DeliveryService] Failed to process queue:', err);
  });

  return taskId;
}

/**
 * Get delivery task by ID
 */
export function getDeliveryTask(taskId: string): DeliveryTask | null {
  ensureDeliveryDirs();
  const taskPath = join(getDeliveryQueueDir(), `${taskId}.json`);

  if (!existsSync(taskPath)) {
    return null;
  }

  try {
    const content = readFileSync(taskPath, 'utf-8');
    return JSON.parse(content) as DeliveryTask;
  } catch (err) {
    console.error(`[DeliveryService] Failed to load task ${taskId}:`, err);
    return null;
  }
}

/**
 * Update delivery task status
 */
function updateDeliveryTaskStatus(
  taskId: string,
  status: DeliveryTask['status'],
  errorMsg?: string
): void {
  const task = getDeliveryTask(taskId);

  if (!task) {
    return;
  }

  task.status = status;

  if (status === 'failed' && errorMsg) {
    task.error = errorMsg;
    task.retryCount++;

    // Calculate next retry time (exponential backoff)
    const backoffMs = Math.min(
      Math.pow(2, task.retryCount) * 1000, // 1s, 2s, 4s, 8s, 16s...
      300000 // Max 5 minutes
    );
    task.nextRetryAt = Date.now() + backoffMs;
  }

  const taskPath = join(getDeliveryQueueDir(), `${taskId}.json`);
  writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf-8');
}

/**
 * Remove completed or failed delivery task
 */
function removeDeliveryTask(taskId: string): void {
  const taskPath = join(getDeliveryQueueDir(), `${taskId}.json`);

  if (existsSync(taskPath)) {
    try {
      unlinkSync(taskPath);
    } catch (err) {
      console.error(`[DeliveryService] Failed to remove task ${taskId}:`, err);
    }
  }
}

/**
 * Get delivery statistics
 */
export function getDeliveryStats(): DeliveryStats {
  ensureDeliveryDirs();
  const files = readdirSync(getDeliveryQueueDir());
  const stats: DeliveryStats = {
    total: files.length,
    pending: 0,
    delivering: 0,
    delivered: 0,
    failed: 0
  };

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const task = getDeliveryTask(file.replace('.json', ''));

    if (task) {
      stats[task.status]++;
    }
  }

  return stats;
}

// ============================================================================
// Delivery Processing
// ============================================================================

/**
 * Process delivery queue (deliver all pending tasks)
 */
export async function processDeliveryQueue(senderHandle?: string): Promise<void> {
  ensureDeliveryDirs();
  const files = readdirSync(getDeliveryQueueDir());
  const now = Date.now();

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const task = getDeliveryTask(file.replace('.json', ''));

    if (!task) {
      continue;
    }

    // Skip tasks that aren't ready to deliver
    if (task.status !== 'pending' && task.nextRetryAt > now) {
      continue;
    }

    // Process task
    await processDeliveryTask(task, senderHandle);
  }
}

/**
 * Process single delivery task
 */
async function processDeliveryTask(task: DeliveryTask, senderHandle?: string): Promise<void> {
  const config = getActivityPubConfig();
  updateDeliveryTaskStatus(task.id, 'delivering');

  let successCount = 0;
  let failCount = 0;

  // Deliver to each recipient
  for (const recipient of task.recipients) {
    try {
      await deliverActivityToRecipient(task.activity, recipient, senderHandle);
      successCount++;

      // Log successful delivery
      logDelivery(task.id, recipient, 'success');
    } catch (err) {
      failCount++;

      // Log failed delivery
      logDelivery(task.id, recipient, 'error', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  // Update task status
  if (failCount === 0) {
    // All recipients delivered successfully
    updateDeliveryTaskStatus(task.id, 'delivered');
    removeDeliveryTask(task.id);
  } else if (successCount === 0) {
    // All recipients failed - mark for retry
    if (task.retryCount >= config.maxDeliveryRetries) {
      // Max retries reached - mark as failed
      updateDeliveryTaskStatus(task.id, 'failed', 'Max retries exceeded');
    } else {
      updateDeliveryTaskStatus(task.id, 'pending', `Failed: ${failCount}/${task.recipients.length} recipients`);
    }
  } else {
    // Partial success - mark as delivered (some succeeded)
    updateDeliveryTaskStatus(task.id, 'delivered');
    removeDeliveryTask(task.id);
  }
}

/**
 * Deliver activity to single recipient
 * @param activity - ActivityPub activity
 * @param recipientUri - Actor URI to deliver to
 * @param senderHandle - Local actor handle (for signing)
 */
async function deliverActivityToRecipient(
  activity: Activity,
  recipientUri: string,
  senderHandle?: string
): Promise<void> {
  const config = getActivityPubConfig();

  // Extract inbox URL from recipient URI
  const inboxUrl = await getActorInbox(recipientUri);

  if (!inboxUrl) {
    throw new DeliveryError(`Could not find inbox for actor: ${recipientUri}`);
  }

  // Sign request if senderHandle is provided
  let requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/activity+json',
      'Accept': 'application/activity+json'
    },
    body: JSON.stringify(activity),
    signal: AbortSignal.timeout(config.federationTimeout)
  };

  if (senderHandle) {
    // Get actor private key for signing
    const { getActorPrivateKey } = await import('./ActorService.js');
    const privateKey = getActorPrivateKey(senderHandle);

    if (!privateKey) {
      console.error(`[DeliveryService] No private key found for ${senderHandle}`);
      throw new DeliveryError('Failed to sign request: Missing private key');
    }

    const keyId = `${getActorUri(senderHandle)}#main-key`;

    // Create signed request
    const signedRequest = await createSignedRequest(
      'POST',
      inboxUrl,
      privateKey,
      keyId,
      activity
    );

    // Apply signed request headers and body
    requestInit.method = signedRequest.method;
    requestInit.headers = Object.fromEntries(signedRequest.headers.entries());
    requestInit.body = signedRequest.body;
  }

  // Deliver activity
  const response = await fetch(inboxUrl, requestInit);

  if (!response.ok) {
    const errorText = await response.text();
    throw new DeliveryError(`HTTP ${response.status}: ${errorText}`);
  }

  console.log(`[DeliveryService] Delivered to ${recipientUri} (${inboxUrl})`);
}

/**
 * Get actor's inbox URL
 */
async function getActorInbox(actorUri: string): Promise<string | null> {
  const config = getActivityPubConfig();

  try {
    // Try to fetch actor object
    const response = await fetch(actorUri, {
      headers: {
        'Accept': 'application/activity+json'
      },
      signal: AbortSignal.timeout(config.federationTimeout)
    });

    if (!response.ok) {
      return null;
    }

    const actor = await response.json();

    if (actor.inbox) {
      return actor.inbox;
    }

    return null;
  } catch (err) {
    console.error(`[DeliveryService] Failed to fetch actor inbox: ${actorUri}`, err);
    return null;
  }
}

// ============================================================================
// Logging
// ============================================================================

function logDelivery(
  taskId: string,
  recipient: string,
  status: 'success' | 'error',
  error?: string
): void {
  const logPath = join(getDeliveryLogsDir(), `${taskId}.log`);

  const logEntry = {
    timestamp: new Date().toISOString(),
    recipient,
    status,
    error
  };

  try {
    const logContent = existsSync(logPath)
      ? readFileSync(logPath, 'utf-8')
      : '';

    writeFileSync(
      logPath,
      logContent + JSON.stringify(logEntry) + '\n',
      'utf-8'
    );
  } catch (err) {
    console.error(`[DeliveryService] Failed to log delivery:`, err);
  }
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up old completed tasks
 */
export function cleanupOldTasks(maxAge = 3600000): void {
  ensureDeliveryDirs();
  const queueDir = getDeliveryQueueDir();
  const files = readdirSync(queueDir);
  const now = Date.now();
  const maxTimestamp = now - maxAge;

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const taskPath = join(queueDir, file);
    const stats = statSync(taskPath);

    // Remove old delivered or failed tasks
    if (stats.mtimeMs < maxTimestamp) {
      const task = getDeliveryTask(file.replace('.json', ''));

      if (task && (task.status === 'delivered' || task.status === 'failed')) {
        try {
          unlinkSync(taskPath);
        } catch (err) {
          console.error(`[DeliveryService] Failed to cleanup task:`, err);
        }
      }
    }
  }
}
