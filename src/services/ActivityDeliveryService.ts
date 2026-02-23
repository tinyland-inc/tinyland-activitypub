




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

  
  processDeliveryQueue(senderHandle).catch(err => {
    console.error('[DeliveryService] Failed to process queue:', err);
  });

  return taskId;
}




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

    
    const backoffMs = Math.min(
      Math.pow(2, task.retryCount) * 1000, 
      300000 
    );
    task.nextRetryAt = Date.now() + backoffMs;
  }

  const taskPath = join(getDeliveryQueueDir(), `${taskId}.json`);
  writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf-8');
}




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

    
    if (task.status !== 'pending' && task.nextRetryAt > now) {
      continue;
    }

    
    await processDeliveryTask(task, senderHandle);
  }
}




async function processDeliveryTask(task: DeliveryTask, senderHandle?: string): Promise<void> {
  const config = getActivityPubConfig();
  updateDeliveryTaskStatus(task.id, 'delivering');

  let successCount = 0;
  let failCount = 0;

  
  for (const recipient of task.recipients) {
    try {
      await deliverActivityToRecipient(task.activity, recipient, senderHandle);
      successCount++;

      
      logDelivery(task.id, recipient, 'success');
    } catch (err) {
      failCount++;

      
      logDelivery(task.id, recipient, 'error', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  
  if (failCount === 0) {
    
    updateDeliveryTaskStatus(task.id, 'delivered');
    removeDeliveryTask(task.id);
  } else if (successCount === 0) {
    
    if (task.retryCount >= config.maxDeliveryRetries) {
      
      updateDeliveryTaskStatus(task.id, 'failed', 'Max retries exceeded');
    } else {
      updateDeliveryTaskStatus(task.id, 'pending', `Failed: ${failCount}/${task.recipients.length} recipients`);
    }
  } else {
    
    updateDeliveryTaskStatus(task.id, 'delivered');
    removeDeliveryTask(task.id);
  }
}







async function deliverActivityToRecipient(
  activity: Activity,
  recipientUri: string,
  senderHandle?: string
): Promise<void> {
  const config = getActivityPubConfig();

  
  const inboxUrl = await getActorInbox(recipientUri);

  if (!inboxUrl) {
    throw new DeliveryError(`Could not find inbox for actor: ${recipientUri}`);
  }

  
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
    
    const { getActorPrivateKey } = await import('./ActorService.js');
    const privateKey = getActorPrivateKey(senderHandle);

    if (!privateKey) {
      console.error(`[DeliveryService] No private key found for ${senderHandle}`);
      throw new DeliveryError('Failed to sign request: Missing private key');
    }

    const keyId = `${getActorUri(senderHandle)}#main-key`;

    
    const signedRequest = await createSignedRequest(
      'POST',
      inboxUrl,
      privateKey,
      keyId,
      activity
    );

    
    requestInit.method = signedRequest.method;
    requestInit.headers = Object.fromEntries(signedRequest.headers.entries());
    requestInit.body = signedRequest.body;
  }

  
  const response = await fetch(inboxUrl, requestInit);

  if (!response.ok) {
    const errorText = await response.text();
    throw new DeliveryError(`HTTP ${response.status}: ${errorText}`);
  }

  console.log(`[DeliveryService] Delivered to ${recipientUri} (${inboxUrl})`);
}




async function getActorInbox(actorUri: string): Promise<string | null> {
  const config = getActivityPubConfig();

  try {
    
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
