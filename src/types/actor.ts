











export interface ActorImage {
  type: 'Image';
  url: string;
  mediaType?: string;
  width?: number;
  height?: number;
}




export interface ActorPropertyValue {
  type: 'PropertyValue';
  name: string;
  value: string; 
}




export interface ActorPublicKey {
  id: string; 
  owner: string; 
  publicKeyPem: string; 
}





export interface Actor {
  
  id: string; 
  type: 'Person' | 'Group' | 'Organization' | 'Application' | 'Service';
  inbox: string; 
  outbox: string; 

  
  following: string; 
  followers: string; 
  liked: string; 
  featured?: string; 
  featuredTags?: string; 

  
  preferredUsername: string; 
  name: string; 
  summary?: string; 
  icon?: ActorImage; 
  image?: ActorImage; 

  
  discoverable?: boolean; 
  indexable?: boolean; 

  
  manuallyApprovesFollowers?: boolean; 
  suspended?: boolean; 
  memorial?: boolean; 

  
  attachment?: ActorPropertyValue[]; 

  
  publicKey: ActorPublicKey; 

  
  published: string; 
  updated?: string; 

  
  url?: string;

  
  endpoints?: {
    sharedInbox?: string;
  };

  
  '@context'?: string | (string | Record<string, string>)[];
}








export interface InternalActor {
  id: string;
  handle: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  website?: string;
  location?: string;
  pronouns?: string;
  email?: string;

  
  mastodon?: string;
  twitter?: string;
  github?: string;
  linkedin?: string;
  instagram?: string;

  
  discoverable: boolean;
  indexable: boolean;
  manuallyApprovesFollowers: boolean;

  
  publicKeyId?: string;
  publicKeyPem?: string;
  privateKeyPem?: string;

  
  actorType: 'Person' | 'Organization' | 'Service';

  
  visibility: 'public' | 'unlisted' | 'followers' | 'private';

  
  createdAt: string;
  updatedAt: string;
}









export function isActor(obj: any): obj is Actor {
  return !!(
    obj &&
    typeof obj === 'object' &&
    obj.inbox &&
    obj.outbox &&
    obj.type &&
    ['Person', 'Group', 'Organization', 'Application', 'Service'].includes(obj.type)
  );
}




export function isActorOfType<T extends Actor['type']>(
  actor: Actor,
  type: T
): actor is Actor & { type: T } {
  return actor.type === type;
}
