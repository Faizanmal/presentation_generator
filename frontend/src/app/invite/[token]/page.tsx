"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { isAuthenticated, isLoading: authLoading, initialized } = useAuthStore();
  const [status, setStatus] = useState<"idle" | "accepting" | "success" | "error">("idle");
  const [message, setMessage] = useState("Accepting your invitation...");

  useEffect(() => {
    if (!initialized || authLoading) {
      return;
    }
    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`);
      return;
    }
    if (!token || status !== "idle") {
      return;
    }

    const accept = async () => {
      setStatus("accepting");
      try {
        await api.acceptInvitation(token);
        setStatus("success");
        setMessage("You joined the workspace.");
        toast.success("Invitation accepted");
        setTimeout(() => router.replace("/dashboard"), 1200);
      } catch (error) {
        const detail =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "This invitation is invalid, expired, or was sent to a different email.";
        setStatus("error");
        setMessage(detail);
      }
    };

    void accept();
  }, [authLoading, initialized, isAuthenticated, router, status, token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="max-w-md w-full text-center space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8">
        {status !== "error" && status !== "success" && (
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        )}
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Team invitation</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
        {status === "error" && (
          <Button onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
        )}
      </div>
    </div>
  );
}
