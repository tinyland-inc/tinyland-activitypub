/**
 * WebFinger Service
 * Implements RFC 7033 WebFinger protocol for ActivityPub actor discovery
 *
 * Reference: https://datatracker.ietf.org/doc/html/rfc7033
 */

import type { Actor } from '../types/actor.js';
import { getActorByHandle } from './ActorService.js';
import { getSiteBaseUrl, getInstanceDomain, getActivityPubConfig } from '../config.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * WebFinger resource descriptor
 */
export interface WebFingerResource {
  subject: string;
  aliases?: string[];
  links: WebFingerLink[];
}

/**
 * WebFinger link descriptor
 */
export interface WebFingerLink {
  rel: string;
  type?: string;
  href?: string;
  template?: string;
  properties?: Record<string, string | boolean>;
}

// ============================================================================
// WebFinger Query Handling
// ============================================================================

/**
 * Parse WebFinger resource string
 */
export function parseResource(resource: string): {
  type: 'acct' | 'url';
  handle?: string;
  domain?: string;
} | null {
  // Account URI (acct:username@domain)
  if (resource.startsWith('acct:')) {
    const match = resource.match(/^acct:([^@]+)@([^@]+)$/);
    if (match) {
      return {
        type: 'acct',
        handle: match[1],
        domain: match[2]
      };
    }
  }

  // URL pattern (https://domain/@username)
  if (resource.startsWith('http://') || resource.startsWith('https://')) {
    try {
      const url = new URL(resource);
      const match = url.pathname.match(/^\/@([^/]+)$/);
      if (match) {
        return {
          type: 'url',
          handle: match[1],
          domain: url.hostname
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Get WebFinger resource descriptor for actor
 * Verifies the actor exists before returning WebFinger data
 */
export async function getWebFingerForResource(resource: string): Promise<WebFingerResource | null> {
  const parsed = parseResource(resource);
  const instanceDomain = getInstanceDomain();
  const baseUrl = getSiteBaseUrl();

  if (!parsed) {
    return null;
  }

  // Validate domain matches this instance
  if (parsed.domain !== instanceDomain) {
    return null;
  }

  const { handle } = parsed;

  if (!handle) {
    return null;
  }

  // Verify the user exists in our system
  // First check if there's an existing actor (from ActivityPub store)
  const actor = getActorByHandle(handle);

  // If no actor, check if user exists via configurable resolution
  if (!actor) {
    const config = getActivityPubConfig();
    if (config.resolveUser) {
      const user = await config.resolveUser(handle);
      if (!user) {
        return null; // User doesn't exist in any source
      }
    } else {
      return null;
    }
  }

  // Build ActivityPub actor URI
  const actorId = `${baseUrl}/@${handle}`;

  // Build profile page URL
  const profileUrl = `${baseUrl}/@${handle}`;

  // Build WebFinger response
  const webFingerResponse: WebFingerResource = {
    subject: resource,
    aliases: [actorId, profileUrl],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actorId
      },
      {
        rel: 'http://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: profileUrl
      },
      {
        rel: 'http://ostatus.org/schema/1.0/subscribe',
        template: `${baseUrl}/authorize_interaction?uri={uri}`
      }
    ]
  };

  return webFingerResponse;
}

/**
 * Get WebFinger resource descriptor from actor object
 */
export function webFingerFromActor(actor: Actor): WebFingerResource {
  const instanceDomain = getInstanceDomain();
  const baseUrl = getSiteBaseUrl();
  const resource = `acct:${actor.preferredUsername}@${instanceDomain}`;

  return {
    subject: resource,
    aliases: [actor.id, actor.url || actor.id],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actor.id
      },
      {
        rel: 'http://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: actor.url || actor.id
      },
      {
        rel: 'http://ostatus.org/schema/1.0/subscribe',
        template: `${baseUrl}/authorize_interaction?uri={uri}`
      }
    ]
  };
}

/**
 * Validate WebFinger query parameters
 */
export function validateWebFingerQuery(params: URLSearchParams): {
  valid: boolean;
  resource?: string;
  error?: string;
} {
  const resource = params.get('resource');
  const instanceDomain = getInstanceDomain();

  if (!resource) {
    return {
      valid: false,
      error: 'Missing required parameter: resource'
    };
  }

  // Validate resource format
  const parsed = parseResource(resource);

  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid resource format. Expected: acct:username@domain'
    };
  }

  // Validate domain
  if (parsed.domain !== instanceDomain) {
    return {
      valid: false,
      error: 'Resource domain does not match this instance'
    };
  }

  // Validate handle (basic validation)
  if (parsed.handle && !/^[a-zA-Z0-9_-]+$/.test(parsed.handle)) {
    return {
      valid: false,
      error: 'Invalid handle format. Only alphanumeric, hyphen, and underscore allowed'
    };
  }

  return {
    valid: true,
    resource
  };
}
