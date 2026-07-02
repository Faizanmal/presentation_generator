import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Subscription } from '@/types';
import { api } from '@/lib/api';

// ⚠️ DEMO MODE: Set to true to skip authentication
const DEMO_MODE = true;

// Mock demo user
const MOCK_USER: User = {
  id: 'demo-user-123',
  email: 'demo@example.com',
  name: 'Demo User',
  image: null,
  organizationId: 'demo-org-123',
};

// Mock demo subscription
const MOCK_SUBSCRIPTION: Subscription = {
  id: 'demo-sub-123',
  userId: 'demo-user-123',
  plan: 'PRO',
  status: 'ACTIVE',
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  cancelledAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as unknown as Subscription;

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
      user: DEMO_MODE ? MOCK_USER : null,
      subscription: DEMO_MODE ? MOCK_SUBSCRIPTION : null,
      isAuthenticated: DEMO_MODE,
      isLoading: false,
      initialized: DEMO_MODE,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          if (DEMO_MODE) {
            console.log('[AuthStore] DEMO MODE - Mock login with', email);
            set({
              user: { ...MOCK_USER, email, name: email.split('@')[0] },
              isAuthenticated: true,
              isLoading: false,
              initialized: true,
            });
            // Fetch subscription after login
            get().fetchSubscription();
            return;
          }
          
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
          if (DEMO_MODE) {
            console.log('[AuthStore] DEMO MODE - Mock OTP login with', identifier);
            set({
              user: { ...MOCK_USER, email: identifier },
              isAuthenticated: true,
              isLoading: false,
              initialized: true,
            });
            get().fetchSubscription();
            return;
          }

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
          if (DEMO_MODE) {
            console.log('[AuthStore] DEMO MODE - Mock register with', email);
            set({
              user: { ...MOCK_USER, email, name },
              isAuthenticated: true,
              isLoading: false,
              initialized: true,
            });
            // Fetch subscription after register
            get().fetchSubscription();
            return;
          }

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
        if (!DEMO_MODE) {
          api.logout();
        }
        set({
          user: DEMO_MODE ? MOCK_USER : null,
          subscription: DEMO_MODE ? MOCK_SUBSCRIPTION : null,
          isAuthenticated: DEMO_MODE,
          isLoading: false,
        });
      },

      fetchProfile: async () => {
        if (DEMO_MODE) {
          console.log('[AuthStore] DEMO MODE - Using mock profile');
          set({
            user: MOCK_USER,
            isAuthenticated: true,
            isLoading: false,
            initialized: true,
          });
          return;
        }

        const token = api.getToken();
        if (!token) {
          console.log('[AuthStore] No token found, not authenticated');
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            initialized: true
          });
          return;
        }

        console.log('[AuthStore] Fetching profile with token:', `${token.substring(0, 20)  }...`);
        try {
          const user = await api.getProfile();
          console.log('[AuthStore] Profile fetched successfully:', user.email);
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            initialized: true,
          });
        } catch (error: unknown) {
          const axiosError = error as { response?: { status?: number }; message?: string };
          const status = axiosError?.response?.status;
          console.error('[AuthStore] Profile fetch failed:', { status, error: axiosError.message });
          if (status === 401 || status === 403) {
            console.log('[AuthStore] Clearing auth state due to 401/403');
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              initialized: true,
            });
          } else {
            set({
              isLoading: false,
              initialized: true,
            });
          }
        }
      },

      fetchSubscription: async () => {
        if (DEMO_MODE) {
          console.log('[AuthStore] DEMO MODE - Using mock subscription');
          set({ subscription: MOCK_SUBSCRIPTION });
          return;
        }

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
