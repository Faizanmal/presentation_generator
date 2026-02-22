import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Subscription } from '@/types';
import { api } from '@/lib/api';

interface AuthState {
  user: User | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // indicates that the initial profile check has completed (success or failure)
  initialized: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  loginWithOtp: (identifier: string, otp: string, rememberDevice?: boolean) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  fetchProfile: () => Promise<void>;
  fetchSubscription: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      subscription: null,
      isAuthenticated: false,
      isLoading: true,
      initialized: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.login({ email, password });
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            initialized: true,
          });
          // Fetch subscription after login
          get().fetchSubscription();
        } catch (error) {
          set({ isLoading: false, initialized: true });
          throw error;
        }
      },

      loginWithOtp: async (identifier: string, otp: string, rememberDevice: boolean = false) => {
        set({ isLoading: true });
        try {
          // Detect channel based on identifier format
          const channel = identifier.includes('@') ? 'email' : 'sms';
          const response = await api.verifyOtpLoginMultiChannel(identifier, otp, channel, rememberDevice);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            initialized: true,
          });
          // Fetch subscription after login
          get().fetchSubscription();
        } catch (error) {
          set({ isLoading: false, initialized: true });
          throw error;
        }
      },

      register: async (email: string, name: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.register({ email, name, password });
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            initialized: true,
          });
          // Fetch subscription after register
          get().fetchSubscription();
        } catch (error) {
          set({ isLoading: false, initialized: true });
          throw error;
        }
      },

      logout: () => {
        api.logout();
        set({
          user: null,
          subscription: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      fetchProfile: async () => {
        if (!api.getToken()) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            initialized: true
          });
          return;
        }

        try {
          const user = await api.getProfile();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            initialized: true,
          });
        } catch {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            initialized: true,
          });
        }
      },

      fetchSubscription: async () => {
        try {
          const subscription = await api.getSubscription();
          set({ subscription });
        } catch (error) {
          console.error('Failed to fetch subscription:', error);
        }
      },

      setUser: (user: User | null) => {
        set({
          user,
          isAuthenticated: !!user,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
