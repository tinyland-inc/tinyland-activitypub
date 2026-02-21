/**
 * ActivityPub UI Types
 * Types for ActivityPub engagement components and federation UI
 */

// ============================================================================
// Content Visibility (local definition to avoid external dependency)
// ============================================================================

/**
 * Content visibility levels
 */
export type ContentVisibility = 'public' | 'unlisted' | 'followers' | 'private' | 'direct';

// ============================================================================
// Engagement Types
// ============================================================================

/**
 * Engagement statistics for ActivityPub objects
 * Used by EngagementBar and individual action buttons
 */
export interface ActivityPubStats {
  /** Number of likes/favorites on this object */
  likes: number;
  /** Number of boosts/announces on this object */
  boosts: number;
  /** Number of replies to this object */
  replies: number;
  /** Whether the current user has liked this object */
  liked?: boolean;
  /** Whether the current user has boosted this object */
  boosted?: boolean;
}

/**
 * API response for engagement actions
 */
export interface EngagementActionResponse {
  success: boolean;
  /** Updated stats after action */
  stats?: ActivityPubStats;
  /** Error message if action failed */
  error?: string;
  /** Whether the action is pending federation */
  pendingFederation?: boolean;
}

/**
 * Federation status for content
 */
export interface FederationStatus {
  /** Whether content is federated */
  federated: boolean;
  /** Number of instances this content has reached */
  instanceCount?: number;
  /** List of known instances (for detailed view) */
  instances?: string[];
  /** When content was last federated */
  lastFederatedAt?: string;
}

/**
 * Visibility display configuration
 */
export interface VisibilityConfig {
  visibility: ContentVisibility;
  icon: string;
  label: string;
  description: string;
  colorClass: string;
}

/**
 * Get visibility configuration for display
 */
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

/**
 * Action types for engagement
 */
export type EngagementAction = 'like' | 'boost' | 'reply';

/**
 * Pending action state for optimistic updates
 */
export interface PendingAction {
  action: EngagementAction;
  objectUrl: string;
  previousState: boolean;
  timestamp: number;
}
