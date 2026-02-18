import { registerAs } from '@nestjs/config';

export default registerAs('features', () => ({
  // Core AI Features
  aiGeneration: process.env.FEATURE_AI_GENERATION === 'true',
  aiImageGeneration: process.env.FEATURE_AI_IMAGE_GENERATION === 'true',
  aiChat: process.env.FEATURE_AI_CHAT === 'true',

  // Advanced Collaboration
  realtimeCollaboration: process.env.FEATURE_REALTIME_COLLABORATION === 'true',
  liveComputers: process.env.FEATURE_LIVE_CURSORS !== 'false', // Default on
  comments: process.env.FEATURE_COMMENTS !== 'false', // Default on

  // Heavy Operations
  videoExport: process.env.FEATURE_VIDEO_EXPORT === 'true',
  highResExport: process.env.FEATURE_HIGH_RES_EXPORT === 'true',

  // Integrations
  googleAuth: process.env.FEATURE_GOOGLE_AUTH === 'true',
  s3Storage: process.env.FEATURE_S3_STORAGE === 'true',

  // Beta Features
  voiceToSlide: process.env.FEATURE_VOICE_TO_SLIDE === 'true',
  analytics: process.env.FEATURE_ANALYTICS === 'true',
}));
