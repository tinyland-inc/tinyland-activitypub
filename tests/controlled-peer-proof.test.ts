import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureActivityPub, resetActivityPubConfig } from '../src/config.js';
import { createBrandActor } from '../src/services/BrandActorService.js';
import {
  createSignedRequest,
  verifyDigest,
  verifyHttpSignature,
} from '../src/services/HttpSignatureService.js';
import type { Activity } from '../src/types/activitystreams.js';

function generateRsaPair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
  };
}

describe('controlled peer ActivityPub proof harness', () => {
  beforeEach(() => {
    resetActivityPubConfig();
    configureActivityPub({
      siteBaseUrl: 'https://tinyland.dev',
      federationTimeout: 1000,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signs outbound brand actor delivery and verifies it as inbound peer traffic', async () => {
    const senderKeys = generateRsaPair();
    const peerKeys = generateRsaPair();

    const sender = createBrandActor({
      slug: 'software-tinyland-dev',
      name: 'Software.tinyland.dev',
      publicKeyPem: senderKeys.publicKeyPem,
      published: '2026-05-10T00:00:00.000Z',
    });

    const peer = createBrandActor({
      slug: 'controlled-peer',
      name: 'Controlled Peer',
      baseUrl: 'https://peer.example',
      publicKeyPem: peerKeys.publicKeyPem,
      published: '2026-05-10T00:00:00.000Z',
    });

    const activity: Activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'https://tinyland.dev/ap/activities/create/software-proof-001',
      type: 'Create',
      actor: sender.id,
      to: [peer.id],
      object: {
        id: 'https://tinyland.dev/ap/content/services/software-proof-001',
        type: 'Note',
        attributedTo: sender.id,
        content: 'Controlled AP proof fixture.',
        to: [peer.id],
      },
    };

    const signedRequest = await createSignedRequest(
      'POST',
      peer.inbox,
      senderKeys.privateKeyPem,
      sender.publicKey.id,
      activity
    );

    const body = await signedRequest.text();
    const digest = signedRequest.headers.get('digest');
    const signature = signedRequest.headers.get('signature');

    expect(signedRequest.method).toBe('POST');
    expect(signedRequest.url).toBe(peer.inbox);
    expect(digest).toBeTruthy();
    expect(signature).toContain(`keyId="${sender.publicKey.id}"`);
    expect(verifyDigest(body, digest ?? '')).toBe(true);

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
      const requestUrl = url instanceof Request ? url.url : String(url);

      if (requestUrl === sender.id) {
        return Response.json(sender, {
          headers: {
            'content-type': 'application/activity+json',
          },
        });
      }

      return new Response('not found', { status: 404 });
    }));

    const inboundRequest = new Request(signedRequest.url, {
      method: signedRequest.method,
      headers: signedRequest.headers,
      body,
    });

    await expect(verifyHttpSignature(inboundRequest, signature ?? '')).resolves.toBe(true);
  });
});
