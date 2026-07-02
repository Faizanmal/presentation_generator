"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { editorV2Api } from "@/features/editor-v2/api/editor-v2-api";
import { EditorV2Shell } from "@/features/editor-v2/components/editor-v2-shell";
import { useAuthStore } from "@/stores/auth-store";

export default function EditorV2Page() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const query = useQuery({
    queryKey: ["editor-v2", projectId],
    queryFn: () => editorV2Api.loadProject(projectId),
    enabled: Boolean(projectId) && isAuthenticated,
  });

  if (authLoading || query.isLoading) {
    return (
      <div className="grid h-screen place-items-center bg-pd-app text-pd-text">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-pd-accent" />
          <p className="mt-3 text-sm text-pd-text-secondary">Loading premium editor...</p>
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="grid h-screen place-items-center bg-pd-app text-pd-text">
        <div className="rounded-xl border border-pd-border bg-pd-panel p-5 text-center">
          <p className="text-base font-semibold">Could not open this project</p>
          <p className="mt-1 text-sm text-pd-text-secondary">Please return to dashboard and retry.</p>
        </div>
      </div>
    );
  }

  return <EditorV2Shell document={query.data} />;
}

