




import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getActorUri, getFollowersDir, getFollowingDir } from '../config.js';





export interface Follower {
  actorUri: string;
  handle: string;
  domain: string;
  displayName?: string;
  avatarUrl?: string;
  followedAt: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
}

export interface Following {
  actorUri: string;
  handle: string;
  domain: string;
  displayName?: string;
  avatarUrl?: string;
  followingSince: string;
  status: 'pending' | 'accepted';
}

export interface FollowRelationship {
  followerUri: string;
  followingUri: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}





function ensureFollowersDir(): void {
  const dir = getFollowersDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function ensureFollowingDir(): void {
  const dir = getFollowingDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}








export function addFollower(
  actorHandle: string,
  follower: Follower
): void {
  ensureFollowersDir();
  const followerPath = join(getFollowersDir(), `${actorHandle}.json`);

  let followers: Follower[] = [];

  if (existsSync(followerPath)) {
    try {
      const content = readFileSync(followerPath, 'utf-8');
      followers = JSON.parse(content) as Follower[];
    } catch (error) {
      console.error(`[FollowersService] Failed to load followers for ${actorHandle}:`, error);
    }
  }

  
  const existingIndex = followers.findIndex(f => f.actorUri === follower.actorUri);

  if (existingIndex >= 0) {
    
    followers[existingIndex] = follower;
  } else {
    
    followers.push(follower);
  }

  writeFileSync(followerPath, JSON.stringify(followers, null, 2), 'utf-8');
}




export function removeFollower(
  actorHandle: string,
  followerUri: string
): void {
  ensureFollowersDir();
  const followerPath = join(getFollowersDir(), `${actorHandle}.json`);

  if (!existsSync(followerPath)) {
    return;
  }

  try {
    const content = readFileSync(followerPath, 'utf-8');
    const followers: Follower[] = JSON.parse(content);

    const filteredFollowers = followers.filter(f => f.actorUri !== followerUri);

    writeFileSync(followerPath, JSON.stringify(filteredFollowers, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[FollowersService] Failed to remove follower:`, error);
  }
}




export function getFollowers(
  actorHandle: string,
  status?: Follower['status']
): Follower[] {
  ensureFollowersDir();
  const followerPath = join(getFollowersDir(), `${actorHandle}.json`);

  if (!existsSync(followerPath)) {
    return [];
  }

  try {
    const content = readFileSync(followerPath, 'utf-8');
    const followers: Follower[] = JSON.parse(content);

    if (status) {
      return followers.filter(f => f.status === status);
    }

    return followers;
  } catch (error) {
    console.error(`[FollowersService] Failed to get followers:`, error);
    return [];
  }
}




export function getFollowerCount(
  actorHandle: string,
  status: Follower['status'] = 'accepted'
): number {
  const followers = getFollowers(actorHandle, status);
  return followers.length;
}




export function isFollowing(
  followerHandle: string,
  followingHandle: string
): boolean {
  const following = getFollowing(followerHandle);
  const followingActorUri = getActorUri(followingHandle);

  return following.some(f => f.actorUri === followingActorUri && f.status === 'accepted');
}








export function addFollowing(
  actorHandle: string,
  following: Following
): void {
  ensureFollowingDir();
  const followingPath = join(getFollowingDir(), `${actorHandle}.json`);

  let followingList: Following[] = [];

  if (existsSync(followingPath)) {
    try {
      const content = readFileSync(followingPath, 'utf-8');
      followingList = JSON.parse(content) as Following[];
    } catch (error) {
      console.error(`[FollowersService] Failed to load following for ${actorHandle}:`, error);
    }
  }

  
  const existingIndex = followingList.findIndex(f => f.actorUri === following.actorUri);

  if (existingIndex >= 0) {
    
    followingList[existingIndex] = following;
  } else {
    
    followingList.push(following);
  }

  writeFileSync(followingPath, JSON.stringify(followingList, null, 2), 'utf-8');
}




export function removeFollowing(
  actorHandle: string,
  followingUri: string
): void {
  ensureFollowingDir();
  const followingPath = join(getFollowingDir(), `${actorHandle}.json`);

  if (!existsSync(followingPath)) {
    return;
  }

  try {
    const content = readFileSync(followingPath, 'utf-8');
    const followingList: Following[] = JSON.parse(content);

    const filteredFollowing = followingList.filter(f => f.actorUri !== followingUri);

    writeFileSync(followingPath, JSON.stringify(filteredFollowing, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[FollowersService] Failed to remove following:`, error);
  }
}




export function getFollowing(
  actorHandle: string,
  status?: Following['status']
): Following[] {
  ensureFollowingDir();
  const followingPath = join(getFollowingDir(), `${actorHandle}.json`);

  if (!existsSync(followingPath)) {
    return [];
  }

  try {
    const content = readFileSync(followingPath, 'utf-8');
    const followingList: Following[] = JSON.parse(content);

    if (status) {
      return followingList.filter(f => f.status === status);
    }

    return followingList;
  } catch (error) {
    console.error(`[FollowersService] Failed to get following:`, error);
    return [];
  }
}




export function getFollowingCount(
  actorHandle: string,
  status: Following['status'] = 'accepted'
): number {
  const following = getFollowing(actorHandle, status);
  return following.length;
}




export function getFollowerUris(
  actorHandle: string,
  status: Follower['status'] = 'accepted'
): string[] {
  const followers = getFollowers(actorHandle, status);
  return followers.map(f => f.actorUri);
}




export function getFollowingUris(
  actorHandle: string,
  status: Following['status'] = 'accepted'
): string[] {
  const following = getFollowing(actorHandle, status);
  return following.map(f => f.actorUri);
}








export function acceptFollowRequest(
  actorHandle: string,
  followerUri: string
): void {
  const followers = getFollowers(actorHandle, 'pending');
  const follower = followers.find(f => f.actorUri === followerUri);

  if (!follower) {
    return;
  }

  
  follower.status = 'accepted';
  addFollower(actorHandle, follower);
}




export function rejectFollowRequest(
  actorHandle: string,
  followerUri: string
): void {
  const followers = getFollowers(actorHandle, 'pending');
  const follower = followers.find(f => f.actorUri === followerUri);

  if (!follower) {
    return;
  }

  
  follower.status = 'rejected';
  addFollower(actorHandle, follower);
}




export function getPendingFollowRequests(actorHandle: string): Follower[] {
  return getFollowers(actorHandle, 'pending');
}








export function extractHandleFromUri(actorUri: string): string | null {
  try {
    const url = new URL(actorUri);
    const handleMatch = url.pathname.match(/^\/@([^/]+)$/);
    return handleMatch ? handleMatch[1] : null;
  } catch {
    return null;
  }
}




export function buildFollowerFromActivity(
  
  activity: any,
  status: Follower['status'] = 'pending'
): Follower | null {
  if (activity.type !== 'Follow') {
    return null;
  }

  const actorUri = typeof activity.actor === 'string'
    ? activity.actor
    : activity.actor.id;

  const handle = extractHandleFromUri(actorUri);

  if (!handle) {
    return null;
  }

  try {
    const url = new URL(actorUri);

    return {
      actorUri,
      handle,
      domain: url.hostname,
      displayName: typeof activity.actor === 'object' ? activity.actor.name : undefined,
      avatarUrl: typeof activity.actor === 'object' ? activity.actor.icon?.url : undefined,
      followedAt: activity.published || new Date().toISOString(),
      status
    };
  } catch {
    return null;
  }
}
