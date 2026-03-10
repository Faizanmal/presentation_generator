"use client";

import { useEffect, type ReactNode, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2 } from "lucide-react";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/marketplace",
  "/terms",
  "/offline"
];

// Routes only accessible to unauthenticated users
const AUTH_ONLY_ROUTES = [
  "/login",
  "/register",
  "/password-reset"
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const { fetchProfile, initialized, isAuthenticated } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [isMounting, setIsMounting] = useState(true);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsMounting(false));
    fetchProfile();
    return () => cancelAnimationFrame(frame);
  }, [fetchProfile]);

  useEffect(() => {
    if (!initialized || isMounting) {
      return;
    }

    // Check if the current route is public or explicitly meant to skip auth checks
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname) ||
      pathname.startsWith('/present/') ||
      pathname.startsWith('/view/') ||
      pathname.startsWith('/embed/') ||
      pathname.startsWith('/auth/google-callback');

    const isAuthOnlyRoute = AUTH_ONLY_ROUTES.some(route => pathname.startsWith(route));

    if (isAuthenticated && isAuthOnlyRoute) {
      // Authenticated users shouldn't see login/register pages
      router.replace('/dashboard');
    } else if (!isAuthenticated && !isPublicRoute && !isAuthOnlyRoute) {
      // Unauthenticated users shouldn't see protected pages
      // Add a redirect param so they can return after login
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [initialized, isAuthenticated, pathname, router, isMounting]);

  // Prevent flashing of protected content while initializing
  if (!initialized || isMounting) {
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname) ||
      pathname.startsWith('/present/') ||
      pathname.startsWith('/view/') ||
      pathname.startsWith('/embed/') ||
      pathname.startsWith('/auth/google-callback');
    const isAuthOnlyRoute = AUTH_ONLY_ROUTES.some(route => pathname.startsWith(route));

    if (!isPublicRoute && !isAuthOnlyRoute) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      );
    }
  }

  return children;
}
