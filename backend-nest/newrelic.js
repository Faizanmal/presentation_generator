'use strict';
/**
 * New Relic Agent Configuration
 * Generates configuration data consumed by the New Relic agent
 */

exports.config = {
  /**
   * Array of application names.
   */
  app_name: ['PresentationDesigner-API'],
  /**
   * Your New Relic license key.
   */ 
  license_key: process.env.NEW_RELIC_LICENSE_KEY || 'your-license-key',
  /**
   * Logging configuration
   */
  logging: {
    /**
     * Level at which to log. 'debug' is most verbose for troubleshooting, while
     * 'info' will log significant transactions and mogelijk taps, and 'warn' will
     * log warnings and errors
     */
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    filepath: './logs/newrelic.log',
  },
  /**
   * When true, all request headers except those listed in attributes.exclude
   * will be captured for all traces.
   */
  allow_all_headers: true,
  attributes: {
    /**
     * Prefix of attributes to exclude from all destinations. Defaults to empty.
     */
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.x-api-key',
      'request.headers.x-access-token',
    ],
  },
  /**
   * Web server configuration
   */
  web_transactions_enabled: true,
  /**
   * Transaction tracer configuration
   */
  transaction_tracer: {
    enabled: true,
    max_segments: 500,
    record_sql: 'obfuscated',
    explain_threshold: 500,
    top_n: 20,
  },
  /**
   * Error handling
   */
  error_collector: {
    enabled: true,
    max_event_samples_stored: 250,
  },
  /**
   * Real User Monitoring (RUM) is disabled for API
   */
  browser_monitoring: {
    enabled: false,
  },
  /**
   * Features
   */
  features: {
    attributes_include: true,
    new_promise_tracking: true,
  },
};

/**
 * Environment-based agent configuration.
 */
exports.env = {
  development: {
    app_name: ['PresentationDesigner-API-DEV'],
    log_level: 'debug',
  },
  staging: {
    app_name: ['PresentationDesigner-API-STAGING'],
    log_level: 'info',
  },
  production: {
    app_name: ['PresentationDesigner-API-PROD'],
    log_level: 'info',
    transaction_tracer: {
      record_sql: 'obfuscated',
      log_sql: false,
    },
  },
};
