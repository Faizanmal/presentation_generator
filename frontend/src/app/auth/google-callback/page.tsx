"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, fetchProfile, fetchSubscription } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      api.setToken(token);
      fetchProfile().then(() => {
        fetchSubscription();
        router.push("/dashboard");
      });
    } else {
      router.push("/login?error=auth_failed");
    }
  }, [searchParams, router, setUser, fetchProfile, fetchSubscription]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-slate-600">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <GoogleCallbackContent />
    </Suspense>
  );
}
