// TIN-1952 / GAP#6 Track B regression tests.
//
// B1: per-user actor identity must anchor on the configured hub origin (not the
//     apex default) once the host app calls configureActivityPub().
// B3: NodeInfo localPosts must reflect the injected public-post counter instead
//     of the legacy src/content scan that always returned 0.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  configureActivityPub,
  resetActivityPubConfig,
  getActorUri,
  getSiteBaseUrl,
} from '../src/config.js';
import { getNodeInfo, getPublicPostCount } from '../src/services/NodeInfoService.js';

describe('TIN-1952 B1: hub-anchored per-user identity', () => {
  beforeEach(() => {
    resetActivityPubConfig();
  });

  afterEach(() => {
    resetActivityPubConfig();
  });

  it('anchors the per-user actor URI on the configured hub origin', () => {
    configureActivityPub({ siteBaseUrl: 'https://hub.tinyland.dev' });
    expect(getActorUri('jesssullivan')).toBe('https://hub.tinyland.dev/@jesssullivan');
    expect(getSiteBaseUrl()).toBe('https://hub.tinyland.dev');
  });

  it('defaults to the hub origin and warns once when configureActivityPub() is never called', () => {
    // TIN-1456 (operator-decided, supersedes the original B1 apex canary):
    // the fail-visible apex default had the leak itself as its failure mode —
    // apex ids delivered to remote instances are cached irreversibly. The
    // default is now fail-safe (hub origin, never the apex), and the canary's
    // job — making a missing configureActivityPub() call visible — survives
    // as a one-time warning instead.
    resetActivityPubConfig();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(getActorUri('jesssullivan')).toBe('https://hub.tinyland.dev/@jesssullivan');

      const unconfiguredWarnings = () =>
        warnSpy.mock.calls.filter(([msg]) =>
          String(msg).includes('configureActivityPub() was never called'),
        );
      expect(unconfiguredWarnings()).toHaveLength(1);

      // One-time: further unconfigured reads do not re-warn.
      getActorUri('jesssullivan');
      getSiteBaseUrl();
      expect(unconfiguredWarnings()).toHaveLength(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not emit the unconfigured warning when configureActivityPub() is called first', () => {
    resetActivityPubConfig();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      configureActivityPub({ siteBaseUrl: 'https://hub.tinyland.dev' });
      getActorUri('jesssullivan');
      expect(
        warnSpy.mock.calls.filter(([msg]) =>
          String(msg).includes('configureActivityPub() was never called'),
        ),
      ).toHaveLength(0);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('TIN-1952 B3: NodeInfo localPosts uses the injected counter', () => {
  beforeEach(() => {
    resetActivityPubConfig();
  });

  afterEach(() => {
    resetActivityPubConfig();
  });

  it('returns the injected public post count (N blog + M notes)', () => {
    const blog = 4;
    const notes = 3;
    configureActivityPub({
      siteBaseUrl: 'https://hub.tinyland.dev',
      resolvePublicPostCount: () => blog + notes,
    });

    expect(getPublicPostCount()).toBe(blog + notes);
  });

  it('reflects the injected count in getNodeInfo().usage.localPosts and is NOT 0', () => {
    configureActivityPub({
      siteBaseUrl: 'https://hub.tinyland.dev',
      resolvePublicPostCount: () => 7,
    });

    const nodeInfo = getNodeInfo();
    expect(nodeInfo.usage.localPosts).toBe(7);
    expect(nodeInfo.usage.localPosts).not.toBe(0);
  });

  it('falls back to the legacy scan when no counter is injected (additive, non-breaking)', () => {
    // No resolvePublicPostCount configured: the legacy filesystem scan runs and
    // returns 0 in this test env (no src/content present). This proves the field
    // is purely additive and the package keeps working without the host wiring.
    configureActivityPub({ siteBaseUrl: 'https://hub.tinyland.dev' });
    expect(getPublicPostCount()).toBe(0);
  });

  it('falls back to the legacy scan when the injected counter throws', () => {
    configureActivityPub({
      siteBaseUrl: 'https://hub.tinyland.dev',
      resolvePublicPostCount: () => {
        throw new Error('loader unavailable');
      },
    });
    // Throwing counter must not crash NodeInfo; it degrades to the legacy scan (0 here).
    expect(getPublicPostCount()).toBe(0);
  });
});
