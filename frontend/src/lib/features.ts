/**
 * Central feature flags. Disabled features stay in the codebase and show
 * Coming soon / Pro states — never 404 or silently no-op.
 *
 * Toggle via NEXT_PUBLIC_FEATURE_* env vars (string "true" / "false").
 * Defaults keep first-session surfaces honest until each feature is ready.
 */

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {return defaultValue;}
  return raw === 'true' || raw === '1';
}

/**
 * Feature flag keys and defaults.
 * When false: keep routes/components, show Coming soon (or Pro lock where noted).
 */
export const FEATURES = {
  /** Try New Editor (/editor-v2) — off until v2 opens existing projects reliably */
  editorV2: envFlag('NEXT_PUBLIC_FEATURE_EDITOR_V2', false),

  /** Team Analytics page + nav */
  teamAnalytics: envFlag('NEXT_PUBLIC_FEATURE_TEAM_ANALYTICS', false),

  /** Invite Team dashboard card / dialog */
  teamInvites: envFlag('NEXT_PUBLIC_FEATURE_TEAM_INVITES', false),

  /** Sell Templates CTA on marketplace */
  sellTemplates: envFlag('NEXT_PUBLIC_FEATURE_SELL_TEMPLATES', false),

  /** Homepage vanity stats (0+ presentations, etc.) */
  homepageStats: envFlag('NEXT_PUBLIC_FEATURE_HOMEPAGE_STATS', false),

  /** Live marketplace browse (when false: honest empty / coming soon) */
  marketplaceBrowse: envFlag('NEXT_PUBLIC_FEATURE_MARKETPLACE', false),

  /** Engagement suite routes that are not ready */
  liveQa: envFlag('NEXT_PUBLIC_FEATURE_LIVE_QA', false),
  learningPaths: envFlag('NEXT_PUBLIC_FEATURE_LEARNING_PATHS', false),
  immersiveView: envFlag('NEXT_PUBLIC_FEATURE_IMMERSIVE', false),
  crossSync: envFlag('NEXT_PUBLIC_FEATURE_CROSS_SYNC', false),

  /** Presentation Coach / AI Co-Pilot hub entries (editor-only today) */
  presentationCoach: envFlag('NEXT_PUBLIC_FEATURE_PRESENTATION_COACH', false),
  aiCopilot: envFlag('NEXT_PUBLIC_FEATURE_AI_COPILOT', false),

  /** White-Label SDK settings page (Enterprise). Off → Coming soon / Pro. */
  whiteLabelSdk: envFlag('NEXT_PUBLIC_FEATURE_WHITE_LABEL_SDK', false),
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURES[key] === true;
}

/** Human labels for Coming soon pages */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  editorV2: 'New Editor',
  teamAnalytics: 'Team Analytics',
  teamInvites: 'Team Invites',
  sellTemplates: 'Sell Templates',
  homepageStats: 'Homepage Stats',
  marketplaceBrowse: 'Template Marketplace',
  liveQa: 'Live Q&A',
  learningPaths: 'Learning Paths',
  immersiveView: 'Immersive View',
  crossSync: 'Cross-Sync',
  presentationCoach: 'Presentation Coach',
  aiCopilot: 'AI Co-Pilot',
  whiteLabelSdk: 'White-Label SDK',
};
