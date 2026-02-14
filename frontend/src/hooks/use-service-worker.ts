'use client';

import { useState, useEffect, useCallback } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isInstalled: boolean;
  isUpdateAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

interface UseServiceWorkerReturn extends ServiceWorkerState {
  update: () => Promise<void>;
  skipWaiting: () => void;
  checkForUpdate: () => Promise<void>;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isInstalled: false,
    isUpdateAvailable: false,
    registration: null,
  });

  const registerServiceWorker = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      setState((prev) => ({
        ...prev,
        isInstalled: true,
        registration,
      }));

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) {return;}

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New update available
            setState((prev) => ({
              ...prev,
              isUpdateAvailable: true,
            }));
          }
        });
      });
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }, []);


  useEffect(() => {
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      return;
    }
    setTimeout(() => {
      setState((prev) => ({ ...prev, isSupported: true }));
    }, 0);

    // Register service worker
    setTimeout(() => {
      registerServiceWorker();
    }, 0);

    // Listen for controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Reload the page when a new service worker takes over
      window.location.reload();
    });
  }, [registerServiceWorker]);

  const update = useCallback(async () => {
    if (!state.registration) {return;}

    try {
      await state.registration.update();
    } catch (error) {
      console.error('Service worker update failed:', error);
    }
  }, [state.registration]);

  const skipWaiting = useCallback(() => {
    if (!state.registration?.waiting) {return;}

    // Tell the waiting service worker to skip waiting
    state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [state.registration]);

  const checkForUpdate = useCallback(async () => {
    if (!state.registration) {return;}

    try {
      await state.registration.update();
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  }, [state.registration]);

  return {
    ...state,
    update,
    skipWaiting,
    checkForUpdate,
  };
}
