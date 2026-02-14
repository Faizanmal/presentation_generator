import { SetMetadata } from '@nestjs/common';

/**
 * Custom throttle decorator for endpoint-specific rate limiting
 * @param ttl Time to live in seconds
 * @param limit Number of requests allowed within TTL
 */
export const Throttle = (ttl: number, limit: number) =>
  SetMetadata('throttle', { ttl, limit });

/**
 * Predefined throttle configurations
 */
export const ThrottleStrict = () => Throttle(60, 10); // 10 requests per minute
export const ThrottleModerate = () => Throttle(60, 30); // 30 requests per minute
export const ThrottleRelaxed = () => Throttle(60, 100); // 100 requests per minute
export const ThrottleAuthEndpoint = () => Throttle(900, 5); // 5 requests per 15 minutes
export const ThrottleOtpEndpoint = () => Throttle(300, 3); // 3 requests per 5 minutes
