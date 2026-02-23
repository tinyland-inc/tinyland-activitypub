











export type ContentVisibility = 'public' | 'unlisted' | 'followers' | 'private' | 'direct';









export interface ActivityPubStats {
  
  likes: number;
  
  boosts: number;
  
  replies: number;
  
  liked?: boolean;
  
  boosted?: boolean;
}




export interface EngagementActionResponse {
  success: boolean;
  
  stats?: ActivityPubStats;
  
  error?: string;
  
  pendingFederation?: boolean;
}




export interface FederationStatus {
  
  federated: boolean;
  
  instanceCount?: number;
  
  instances?: string[];
  
  lastFederatedAt?: string;
}




export interface VisibilityConfig {
  visibility: ContentVisibility;
  icon: string;
  label: string;
  description: string;
  colorClass: string;
}




export function getVisibilityConfig(visibility: ContentVisibility): VisibilityConfig {
  const configs: Record<ContentVisibility, VisibilityConfig> = {
    public: {
      visibility: 'public',
      icon: 'lucide:globe',
      label: 'Public',
      description: 'Visible to everyone, appears in public timelines',
      colorClass: 'preset-filled-success-500'
    },
    unlisted: {
      visibility: 'unlisted',
      icon: 'lucide:eye-off',
      label: 'Unlisted',
      description: 'Visible to everyone, but not in public timelines',
      colorClass: 'preset-filled-secondary-500'
    },
    followers: {
      visibility: 'followers',
      icon: 'lucide:users',
      label: 'Followers Only',
      description: 'Only visible to your followers',
      colorClass: 'preset-filled-warning-500'
    },
    private: {
      visibility: 'private',
      icon: 'lucide:lock',
      label: 'Private',
      description: 'Only visible to you',
      colorClass: 'preset-filled-error-500'
    },
    direct: {
      visibility: 'direct',
      icon: 'lucide:mail',
      label: 'Direct',
      description: 'Only visible to mentioned users',
      colorClass: 'preset-filled-tertiary-500'
    }
  };

  return configs[visibility] ?? configs.public;
}




export type EngagementAction = 'like' | 'boost' | 'reply';




export interface PendingAction {
  action: EngagementAction;
  objectUrl: string;
  previousState: boolean;
  timestamp: number;
}
