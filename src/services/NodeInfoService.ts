







import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { getSiteBaseUrl, getActorsDir, getActivityPubConfig } from '../config.js';





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





export function getPublicPostCount(): number {
  let count = 0;

  try {
    const contentDir = join(process.cwd(), 'src', 'content');

    
    const blogDir = join(contentDir, 'blog');
    if (existsSync(blogDir)) {
      count += readdirSync(blogDir).filter(f => f.endsWith('.md')).length;
    }

    
    const notesDir = join(contentDir, 'notes');
    if (existsSync(notesDir)) {
      count += readdirSync(notesDir).filter(f => f.endsWith('.md')).length;
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
      repository: 'https://gitlab.com/tinyland/tinyland.dev',
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
