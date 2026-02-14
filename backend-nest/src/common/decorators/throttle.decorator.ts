import { SetMetadata } from '@nestjs/common';

/**
 * Custom throttle decorator for endpoint-specific rate limiting
 * @param ttl Time to live in seconds
 * @param limit Number of requests allowed within TTL
 */
export const Throttle = (ttl: number, limit: number) =>
  SetMetadata('throttle', { ttl, limit });

/**
 * Predefined throttle configurations for common use cases
 */

// Authentication & Security
export const ThrottleAuthEndpoint = () => Throttle(900, 5); // 5 requests per 15 minutes - prevent brute force
export const ThrottleOtpEndpoint = () => Throttle(300, 3); // 3 requests per 5 minutes - prevent OTP spam

// AI Operations - Very expensive, strict limits
export const ThrottleAIGeneration = () => Throttle(300, 5); // 5 requests per 5 minutes
export const ThrottleAIPersonalization = () => Throttle(180, 10); // 10 requests per 3 minutes
export const ThrottleImageGeneration = () => Throttle(600, 3); // 3 requests per 10 minutes - DALL-E is expensive

// Export Operations - Resource intensive
export const ThrottleExportPDF = () => Throttle(60, 10); // 10 exports per minute
export const ThrottleExportHTML = () => Throttle(60, 20); // 20 exports per minute (less intensive)
export const ThrottleExportVideo = () => Throttle(300, 5); // 5 video exports per 5 minutes (very intensive)

// File Operations
export const ThrottleUpload = () => Throttle(60, 20); // 20 uploads per minute
export const ThrottleImageUpload = () => Throttle(60, 30); // 30 image uploads per minute

// Payment Operations - Critical, strict limits
export const ThrottlePayment = () => Throttle(60, 3); // 3 payment requests per minute
export const ThrottleSubscription = () => Throttle(300, 10); // 10 subscription changes per 5 minutes

// General CRUD Operations
export const ThrottleStrict = () => Throttle(60, 10); // 10 requests per minute
export const ThrottleModerate = () => Throttle(60, 30); // 30 requests per minute
export const ThrottleRelaxed = () => Throttle(60, 100); // 100 requests per minute

// Webhook & Integration
export const ThrottleWebhook = () => Throttle(60, 100); // 100 webhook calls per minute
export const ThrottleIntegration = () => Throttle(60, 50); // 50 integration API calls per minute

// Collaboration & Real-time
export const ThrottleCollaboration = () => Throttle(60, 200); // 200 collab updates per minute
export const ThrottleComments = () => Throttle(60, 30); // 30 comments per minute

// Analytics & Reporting
export const ThrottleAnalytics = () => Throttle(60, 50); // 50 analytics queries per minute
export const ThrottleReports = () => Throttle(300, 10); // 10 report generations per 5 minutes
