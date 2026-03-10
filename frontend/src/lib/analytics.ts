/**
 * Analytics Utility
 * 
 * Centralized analytics tracking for Google Analytics and Google Tag Manager
 * Tracks user interactions, events, and conversions across the application
 */

/**
 * Track a custom event
 * @param eventName - The name of the event
 * @param params - Additional parameters to send with the event
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Send to Google Analytics
  if (window.gtag) {
    window.gtag('event', eventName, params);
  }

  // Send to Google Tag Manager
  if (window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...params,
    });
  }
}

/**
 * Track page view
 * @param url - The URL of the page
 * @param title - The title of the page
 */
export function trackPageView(url: string, title?: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: url,
      page_title: title,
    });
  }

  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'page_view',
      page_path: url,
      page_title: title,
    });
  }
}

/**
 * Predefined analytics events for common actions
 */
export const analytics = {
  // Project events
  project: {
    create: (method: 'blank' | 'ai-generated') => {
      trackEvent('project_created', {
        event_category: 'project',
        event_label: method,
        method,
      });
    },
    open: (projectId: string) => {
      trackEvent('project_opened', {
        event_category: 'project',
        project_id: projectId,
      });
    },
    duplicate: (projectId: string) => {
      trackEvent('project_duplicated', {
        event_category: 'project',
        project_id: projectId,
      });
    },
    delete: (projectId: string) => {
      trackEvent('project_deleted', {
        event_category: 'project',
        project_id: projectId,
      });
    },
    search: (query: string, resultsCount: number) => {
      trackEvent('project_searched', {
        event_category: 'project',
        search_query: query,
        results_count: resultsCount,
      });
    },
  },

  // AI Generation events
  ai: {
    generate: (params: {
      topic: string;
      tone: string;
      audience: string;
      length: number;
      generateImages: boolean;
    }) => {
      trackEvent('ai_presentation_generated', {
        event_category: 'ai',
        event_label: 'presentation_generation',
        topic: params.topic,
        tone: params.tone,
        audience: params.audience,
        slide_count: params.length,
        with_images: params.generateImages,
      });
    },
    contentSuggestion: (type: string) => {
      trackEvent('ai_suggestion_used', {
        event_category: 'ai',
        event_label: type,
        suggestion_type: type,
      });
    },
  },

  // User engagement events
  engagement: {
    viewModeChange: (mode: 'grid' | 'list') => {
      trackEvent('view_mode_changed', {
        event_category: 'engagement',
        view_mode: mode,
      });
    },
    toggleFavorite: (projectId: string, isFavorite: boolean) => {
      trackEvent('favorite_toggled', {
        event_category: 'engagement',
        project_id: projectId,
        is_favorite: isFavorite,
      });
    },
    featureClick: (featureName: string) => {
      trackEvent('feature_clicked', {
        event_category: 'engagement',
        feature_name: featureName,
      });
    },
    dashboardVersion: (version: 'v1' | 'v2') => {
      trackEvent('dashboard_version_switched', {
        event_category: 'engagement',
        version,
      });
    },
  },

  // Export events
  export: {
    pdf: (projectId: string, slideCount: number) => {
      trackEvent('export_pdf', {
        event_category: 'export',
        project_id: projectId,
        slide_count: slideCount,
      });
    },
    pptx: (projectId: string, slideCount: number) => {
      trackEvent('export_pptx', {
        event_category: 'export',
        project_id: projectId,
        slide_count: slideCount,
      });
    },
    image: (projectId: string, format: string) => {
      trackEvent('export_image', {
        event_category: 'export',
        project_id: projectId,
        format,
      });
    },
  },

  // Collaboration events
  collaboration: {
    share: (projectId: string, method: string) => {
      trackEvent('project_shared', {
        event_category: 'collaboration',
        project_id: projectId,
        share_method: method,
      });
    },
    commentAdded: (projectId: string) => {
      trackEvent('comment_added', {
        event_category: 'collaboration',
        project_id: projectId,
      });
    },
  },

  // Navigation events
  navigation: {
    clickLink: (destination: string, source: string) => {
      trackEvent('navigation_click', {
        event_category: 'navigation',
        destination,
        source,
      });
    },
  },

  // Subscription events
  subscription: {
    upgrade: (plan: string) => {
      trackEvent('subscription_upgrade', {
        event_category: 'subscription',
        plan,
        value: 1,
      });
    },
    cancel: (plan: string) => {
      trackEvent('subscription_cancelled', {
        event_category: 'subscription',
        plan,
      });
    },
  },

  // Error tracking
  error: {
    occurred: (errorType: string, errorMessage: string) => {
      trackEvent('error_occurred', {
        event_category: 'error',
        error_type: errorType,
        error_message: errorMessage,
      });
    },
  },

};

/**
 * Hook for analytics in React components
 */
export function useAnalytics() {
  return {
    trackEvent,
    trackPageView,
    ...analytics,
  };
}
