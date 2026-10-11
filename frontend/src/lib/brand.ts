/**
 * Single source of truth for product branding.
 * Import PRODUCT_NAME (or BRAND) everywhere — never hardcode the name in UI.
 */
export const PRODUCT_NAME = 'PresentPitch' as const;

export const BRAND = {
  name: PRODUCT_NAME,
  tagline: 'AI-Powered Presentations',
  description:
    'Create stunning presentations in minutes with AI. Transform your ideas into beautifully designed slides.',
  /** Used in <title> and metadata */
  titleDefault: `${PRODUCT_NAME} - AI-Powered Presentations`,
  /** Short alt text for logo images */
  logoAlt: `${PRODUCT_NAME} logo`,
  supportEmail: 'support@presentpitch.app',
} as const;

export type Brand = typeof BRAND;
