"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { fetchProfile } = useAuthStore();

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return <>{children}</>;
}
