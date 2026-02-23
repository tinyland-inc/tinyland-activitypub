










export interface ASObject {
  id: string;
  type: string;
  '@context'?: string | (string | Record<string, unknown>)[];

  
  name?: string;
  summary?: string;
  content?: string;
  mediaType?: string;
  published?: string;
  updated?: string;
  attributedTo?: string | ASLink | ASObject | (string | ASObject)[];
  to?: string[] | ASLink;
  cc?: string[] | ASLink;
  bto?: string[] | ASLink;
  bcc?: string[] | ASLink;
  url?: string | ASLink | ASLink[];
  attachment?: (ASObject | ASLink)[];
  tag?: (ASObject | ASLink)[];
  audience?: string | ASLink;
  inReplyTo?: string | ASLink | (string | ASLink)[];
  context?: string;

  
  likes?: string | Collection;
  shares?: string | Collection;
  replies?: string | Collection;

  
  icon?: Image | ASLink | { type: string; url: string };
  image?: Image | ASLink | { type: string; url: string };
}





export interface ASLink {
  href: string;
  type?: string;
  mediaType?: string;
  name?: string;
  hreflang?: string;
  rel?: string;
  width?: number;
  height?: number;
}





export interface Activity extends ASObject {
  type: 'Create' | 'Update' | 'Delete' | 'Add' | 'Remove' | 'Move' |
        'Follow' | 'Like' | 'Announce' | 'Undo' | 'Accept' | 'Reject' |
        'Block' | 'Flag';
  actor: string | ASObject; 
  object: string | ASObject | (string | ASObject)[]; 
  target?: string | ASObject; 
  origin?: string | ASObject; 
  result?: string | ASObject;
  instrument?: string | ASObject;
}

export interface IntransitiveActivity extends ASObject {
  type: 'Travel' | 'Arrive' | 'Depart' | 'Question';
  actor: string | ASObject;
  object?: never; 
  target?: string | ASObject;
  origin?: string | ASObject;
  result?: string | ASObject;
  instrument?: string | ASObject;
}


export interface Follow extends Activity {
  type: 'Follow';
}

export interface Like extends Activity {
  type: 'Like';
}

export interface Announce extends Activity {
  type: 'Announce';
}

export interface Accept extends Activity {
  type: 'Accept';
  object: Activity | string; 
}

export interface Reject extends Activity {
  type: 'Reject';
  object: Activity | string; 
}

export interface Undo extends Activity {
  type: 'Undo';
  object: Activity | ASObject | string; 
}





export interface Note extends ASObject {
  type: 'Note';
  content: string;
  mediaType?: string;
  inReplyTo?: string | ASLink | (string | ASLink)[];
  context?: string;
  conversation?: string;
  sensitive?: boolean;
  summary?: string; 
}

export interface Article extends ASObject {
  type: 'Article';
  name: string;
  url: string;
  content: string;
  mediaType?: string;
  attributedTo?: string | ASObject;
}

export interface Page extends ASObject {
  type: 'Page';
  name: string;
  url: string;
}

export interface Video extends ASObject {
  type: 'Video';
  url: string | ASLink[];
  mediaType?: string;
  duration?: string; 
  width?: number;
  height?: number;
}

export interface Image extends ASObject {
  type: 'Image';
  url: string;
  href?: string;
  mediaType?: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface Audio extends ASObject {
  type: 'Audio';
  url: string | ASLink[];
  duration?: string;
}

export interface Event extends ASObject {
  type: 'Event';
  startTime: string;
  endTime: string;
  location?: Place | ASLink;
}

export interface Place extends ASObject {
  type: 'Place';
  name?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
}

export interface Document extends ASObject {
  type: 'Document';
  url: string;
  mediaType?: string;
  size?: number;
}

export interface Tombstone extends ASObject {
  type: 'Tombstone';
  formerType: string;
  deleted: string;
}





export interface Collection extends ASObject {
  type: 'Collection';
  totalItems: number;
  items?: (ASObject | ASLink)[];
  first?: string | CollectionPage;
  last?: string | CollectionPage;
  current?: string | CollectionPage;
}

export interface OrderedCollection extends ASObject {
  type: 'OrderedCollection';
  totalItems: number;
  orderedItems?: (ASObject | ASLink)[];
  first?: string | OrderedCollectionPage;
  last?: string | OrderedCollectionPage;
  current?: string | OrderedCollectionPage;
}

export interface CollectionPage extends ASObject {
  type: 'CollectionPage';
  partOf: string; 
  
  items?: (ASObject | ASLink | string)[];
  next?: string;
  prev?: string;
  totalItems?: number;
}

export interface OrderedCollectionPage extends ASObject {
  type: 'OrderedCollectionPage';
  partOf: string;
  
  orderedItems?: (ASObject | ASLink | string)[];
  next?: string;
  prev?: string;
  totalItems?: number;
}





export interface Person extends ASObject {
  type: 'Person';
  inbox: string;
  outbox: string;
  following: string;
  followers: string;
  liked: string;
  preferredUsername: string;
  name?: string;
  summary?: string;
  url?: string;
  icon?: Image;
  image?: Image;
  publicKey?: PublicKey;
  discoverable?: boolean;
  manuallyApprovesFollowers?: boolean;
}

export interface Group extends ASObject {
  type: 'Group';
  inbox: string;
  outbox: string;
  following?: string;
  followers: string;
  preferredUsername?: string;
  name?: string;
  summary?: string;
  members?: Collection;
  url?: string;
  icon?: Image;
  image?: Image;
  publicKey?: PublicKey;
  discoverable?: boolean;
  indexable?: boolean;
  
  attributedTo?: string | string[]; 
  postingRestrictedToMods?: boolean;
  moderators?: string[];
  sensitive?: boolean; 
  
  endpoints?: {
    sharedInbox?: string;
  };
}

export interface Organization extends ASObject {
  type: 'Organization';
  inbox: string;
  outbox: string;
  following: string;
  followers: string;
  name?: string;
  summary?: string;
  url?: string;
}

export interface Application extends ASObject {
  type: 'Application';
  inbox: string;
  outbox: string;
  name?: string;
  summary?: string;
  url?: string;
}

export interface Service extends ASObject {
  type: 'Service';
  inbox: string;
  outbox: string;
  name?: string;
  summary?: string;
  url?: string;
}





export interface Mention extends ASLink {
  type: 'Mention';
  href: string;
  name?: string;
}

export interface Hashtag extends ASLink {
  type: 'Hashtag';
  href: string;
  name?: string;
}

export interface PropertyValue extends ASObject {
  type: 'PropertyValue';
  name: string;
  value: string;
}

export interface PublicKey {
  id: string;
  owner: string;
  publicKeyPem: string;
}
