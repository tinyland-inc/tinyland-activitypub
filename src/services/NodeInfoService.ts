







import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { getSiteBaseUrl, getActorsDir, getActivityPubConfig, getUsersContentDir } from '../config.js';





export interface NodeInfo {
  version: '2.1';
  software: {
    name: string;
    version: string;
    repository?: string;
    homepage?: string;
  };
  protocols: string[];
  services: {
    inbound: string[];
    outbound: string[];
  };
  openRegistrations: boolean;
  usage: {
    users: {
      total: number;
      activeHalfyear: number | null;
      activeMonth: number | null;
    };
    localPosts: number;
    localComments?: number;
  };
  metadata: Record<string, unknown>;
}

export interface NodeInfoLinks {
  links: {
    rel: string;
    href: string;
  }[];
}








export function getUserCount(): number {
  try {
    const actorsDir = getActorsDir();
    
    if (existsSync(actorsDir)) {
      const files = readdirSync(actorsDir).filter(f => f.endsWith('.json'));
      return files.length;
    }

    return 0;
  } catch (err) {
    console.error('[NodeInfo] Failed to count users:', err);
    return 0;
  }
}





const PUBLIC_POST_CONTENT_TYPES = ['blog', 'notes'] as const;

function isPublicPublishedPost(filePath: string): boolean {
  try {
    const { data } = matter(readFileSync(filePath, 'utf-8'));
    if (data.published === false || data.draft === true) {
      return false;
    }
    return (data.visibility || 'public') === 'public';
  } catch {
    return false;
  }
}

export function getPublicPostCount(): number {
  // TIN-1952 / GAP#6 B3: prefer an injected counter from the host app. The legacy
  // src/content/blog|notes scan below never matched the user-content layout
  // (content/users/{handle}/{type}), so localPosts was always 0. The host wires
  // resolvePublicPostCount via configureActivityPub to read its real content loader.
  const { resolvePublicPostCount } = getActivityPubConfig();
  if (resolvePublicPostCount) {
    try {
      const injected = resolvePublicPostCount();
      if (typeof injected === 'number' && Number.isFinite(injected) && injected >= 0) {
        return injected;
      }
    } catch (err) {
      console.error('[NodeInfo] Injected post counter failed, falling back to scan:', err);
    }
  }

  let count = 0;

  try {
    // TIN-1931: fallback scan — posts live under <contentDir>/users/<handle>/{blog,notes},
    // not the legacy src/content root. Count only public, published posts.
    const usersDir = getUsersContentDir();
    if (!existsSync(usersDir)) {
      return 0;
    }

    const handles = readdirSync(usersDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const handle of handles) {
      for (const contentType of PUBLIC_POST_CONTENT_TYPES) {
        const dir = join(usersDir, handle, contentType);
        if (!existsSync(dir)) {
          continue;
        }

        const files = readdirSync(dir).filter(
          (f) => f.endsWith('.md') || f.endsWith('.mdx')
        );

        for (const file of files) {
          if (isPublicPublishedPost(join(dir, file))) {
            count++;
          }
        }
      }
    }

    return count;
  } catch (err) {
    console.error('[NodeInfo] Failed to count posts:', err);
    return 0;
  }
}




export function getLocalCommentCount(): number {
  return 0;
}









export function getNodeInfoLinks(): NodeInfoLinks {
  const baseUrl = getSiteBaseUrl();

  return {
    links: [
      {
        rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
        href: `${baseUrl}/nodeinfo/2.1`
      },
      {
        rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
        href: `${baseUrl}/nodeinfo/2.0`
      }
    ]
  };
}





export function getNodeInfo(): NodeInfo {
  const baseUrl = getSiteBaseUrl();
  const config = getActivityPubConfig();
  const userCount = getUserCount();
  const postCount = getPublicPostCount();

  return {
    version: '2.1',
    software: {
      name: 'tinyland',
      version: config.softwareVersion || '1.0.0',
      repository: 'https://github.com/tinyland-inc/tinyland.dev',
      homepage: baseUrl
    },
    protocols: ['activitypub'],
    services: {
      inbound: [],
      outbound: ['atom1.0', 'rss2.0']
    },
    openRegistrations: false,
    usage: {
      users: {
        total: userCount,
        activeHalfyear: null,
        activeMonth: null
      },
      localPosts: postCount,
      localComments: getLocalCommentCount()
    },
    metadata: {
      nodeName: 'Tinyland',
      nodeDescription: 'LGBTQ+ community platform with ActivityPub federation',
      maintainer: {
        name: 'Tinyland Team',
        email: 'admin@tinyland.dev'
      },
      languages: ['en'],
      federation: {
        enabled: config.federationEnabled,
        allowList: null,
        blockList: []
      },
      features: [
        'activitypub',
        'webfinger',
        'http-signatures',
        'mastodon-api-compat'
      ],
      contentTypes: [
        'Article',
        'Note',
        'Image',
        'Video',
        'Page',
        'Event'
      ]
    }
  };
}




export function getNodeInfo20(): Omit<NodeInfo, 'version'> & { version: '2.0' } {
  const nodeInfo = getNodeInfo();
  return {
    ...nodeInfo,
    version: '2.0'
  };
}
