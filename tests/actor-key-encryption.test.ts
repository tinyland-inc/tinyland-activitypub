import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  encryptPrivateKey,
  decryptPrivateKey,
} from '../src/services/ActorService.js';

// TIN-2648: private-key custody. encryptPrivateKey must fail closed when no
// key-encryption secret is available — it must never fall back to storing the
// private key in plaintext.

// Non-secret test fixtures only (no real key material).
const FIXTURE_PEM =
  '-----BEGIN PRIVATE KEY-----\nTEST-ONLY-NOT-A-REAL-KEY\n-----END PRIVATE KEY-----';
const KEY_ENV_VARS = [
  'ACTIVITYPUB_KEY_ENCRYPTION_KEY',
  'TOTP_ENCRYPTION_KEY',
  'AUTH_SECRET',
] as const;

describe('ActivityPub private key encryption (fail-closed)', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const name of KEY_ENV_VARS) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of KEY_ENV_VARS) {
      if (saved[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = saved[name];
      }
    }
  });

  it('throws (never returns plaintext) when no key-encryption secret is configured', () => {
    expect(() => encryptPrivateKey(FIXTURE_PEM)).toThrow(
      /no key-encryption secret is configured/
    );
    // Error must name the missing precondition so operators can fix it.
    expect(() => encryptPrivateKey(FIXTURE_PEM)).toThrow(
      /ACTIVITYPUB_KEY_ENCRYPTION_KEY/
    );
  });

  it('throws when the configured secret is too short (precondition unmet)', () => {
    process.env.ACTIVITYPUB_KEY_ENCRYPTION_KEY = 'short'; // < 16 chars
    expect(() => encryptPrivateKey(FIXTURE_PEM)).toThrow(
      /no key-encryption secret is configured/
    );
  });

  it('encrypts to an enc:-prefixed ciphertext (not plaintext) when configured', () => {
    process.env.ACTIVITYPUB_KEY_ENCRYPTION_KEY =
      'test-only-key-encryption-secret-32chars';
    const stored = encryptPrivateKey(FIXTURE_PEM);
    expect(stored).not.toBe(FIXTURE_PEM);
    expect(stored.startsWith('enc:')).toBe(true);
  });

  it('round-trips through decryptPrivateKey with a configured secret', () => {
    process.env.ACTIVITYPUB_KEY_ENCRYPTION_KEY =
      'test-only-key-encryption-secret-32chars';
    const stored = encryptPrivateKey(FIXTURE_PEM);
    expect(decryptPrivateKey(stored)).toBe(FIXTURE_PEM);
  });
});
