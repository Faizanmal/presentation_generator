// Sentry initialization for frontend error tracking
// Install: npm install @sentry/nextjs

export function initSentry() {
  if (typeof window === 'undefined') return;

  const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Error tracking is disabled.');
    return;
  }

  // Dynamically import and initialize Sentry
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'development',
      
      // Performance Monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Session Replay
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
      
      // Enhanced error context
      integrations: [
        // new Sentry.BrowserTracing({
        //   tracePropagationTargets: ['localhost', /^https:\/\/.*\.yourapp\.com/],
        // }),
        // new Sentry.Replay({
        //   maskAllText: true,
        //   blockAllMedia: true,
        // }),
      ],
      
      // Filter out common non-critical errors
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        'ChunkLoadError',
        'Loading chunk',
        'Hydration failed',
      ],
      
      beforeSend(event, hint) {
        // Don't send errors in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Sentry event (dev mode, not sent):', event);
          return null;
        }
        
        // Filter out errors from browser extensions
        if (event.exception) {
          const frames = event.exception.values?.[0]?.stacktrace?.frames;
          if (frames?.some((frame) => 
            frame.filename?.includes('chrome-extension://') || 
            frame.filename?.includes('moz-extension://')
          )) {
            return null;
          }
        }
        
        return event;
      },
    });

    // Expose Sentry globally for ErrorBoundary
    (window as any).Sentry = Sentry;
  }).catch(err => {
    console.warn('Failed to initialize Sentry:', err);
  });
}

// Call this in your root layout or _app.tsx
export function setupErrorTracking() {
  if (typeof window !== 'undefined') {
    // Initialize Sentry
    initSentry();
    
    // Global error handlers
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
    });
  }
}
