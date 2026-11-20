"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  LayoutGrid,
  List,
  Loader2,
  FileText,
  Plus,
  Wand2,
  Sparkles,
  Lock,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { aiGenerationLimit, presentationLimit } from "@/lib/plans";
import {
  generationFailureMessage,
  isPlanLimitError,
  parseApiError,
  planLimitUserMessage,
} from "@/lib/api-errors";
import { analytics } from "@/lib/analytics";
import type { Project } from "@/types";
import { FeaturesHub } from "@/components/dashboard/features-hub";
import { FEATURES } from "@/lib/features";
import { ComingSoonModal } from "@/components/ui/coming-soon";
import { UpgradePrompt } from "@/components/ui/pro-badge";

// Dynamically import heavy/secondary components for performance
const CommandPalette = dynamic(() => import("@/components/ui/command-palette").then(mod => mod.CommandPalette), { ssr: false });
const KeyboardShortcutsDialog = dynamic(() => import("@/components/ui/keyboard-shortcuts").then(mod => mod.KeyboardShortcutsDialog), { ssr: false });
const FavoritesRecentPanel = dynamic(() => import("@/components/ui/favorites-recent").then(mod => mod.FavoritesRecentPanel), { ssr: false });
const InviteTeamDialog = dynamic(
  () => import("@/components/dashboard/invite-team-dialog").then((mod) => mod.InviteTeamDialog),
  { ssr: false }
);
const QuickActionsGrid = dynamic(() => import("@/components/ui/dashboard-widgets").then(mod => mod.QuickActionsGrid), { ssr: false });
const UsageCard = dynamic(() => import("@/components/ui/dashboard-widgets").then(mod => mod.UsageCard), { ssr: false });
const ProjectCard = dynamic(() => import("@/components/ui/project-card").then(mod => mod.ProjectCard), { ssr: false });

// Hooks (must stay synchronous — not components)
import {
  useFavorites,
  useRecentProjects,
} from "@/components/ui/favorites-recent";

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const _user = useAuthStore((state) => state.user);
  const subscription = useAuthStore((state) => state.subscription);
  const fetchSubscription = useAuthStore((state) => state.fetchSubscription);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.isLoading);
  const initialized = useAuthStore((state) => state.initialized);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showInviteTeam, setShowInviteTeam] = useState(false);
  const [showInviteComingSoon, setShowInviteComingSoon] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeDescription, setUpgradeDescription] = useState<string | undefined>();

  // Favorites and recent projects
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { recent, removeFromRecent, clearRecent } = useRecentProjects();

  // Redirect if not authenticated
  useEffect(() => {
    if (initialized && !authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, initialized, router]);

  // Refresh projects when page regains focus or becomes visible (in case generation completed while user was away)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    };

    const handleFocus = () => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, queryClient]);

  // Fetch projects in parallel with user/subscription with stale-while-revalidate caching
  const {
    data: projects,
    isLoading: projectsLoading,
    isError: projectsError,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.projects.getAll(),
    enabled: isAuthenticated || !initialized,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const showPlanLimitError = useCallback(
    (error: unknown) => {
      const message = planLimitUserMessage(error, {
        presentationsUsed: subscription?.projectsUsed,
        presentationsLimit:
          subscription?.projectsLimit ?? presentationLimit(subscription?.plan),
        aiUsed: subscription?.aiGenerationsUsed,
        aiLimit:
          subscription?.aiGenerationsLimit ??
          aiGenerationLimit(subscription?.plan),
        plan: subscription?.plan,
      });
      setUpgradeDescription(message);
      setUpgradeOpen(true);
      toast.error(message, {
        action: {
          label: "Upgrade",
          onClick: () => router.push("/settings/billing"),
        },
      });
    },
    [router, subscription],
  );

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: (data: { title: string; type: string }) => api.projects.create(data),
    onSuccess: (project) => {
      void fetchSubscription();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      analytics.project.create('blank');
      router.push(`/editor/${project.id}`);
    },
    onError: (error) => {
      if (isPlanLimitError(error)) {
        showPlanLimitError(error);
        return;
      }
      const { message } = parseApiError(error);
      toast.error(message || "Failed to create project");
    },
  });

  // Generate project mutation
  const generateProjectMutation = useMutation({
    mutationFn: (data: { topic: string; tone: string; audience: string; length: number; type: string; generateImages?: boolean; imageSource?: 'ai' | 'stock'; qualityMode?: boolean }) =>
      api.projects.generate(data),
    onSuccess: (job, variables) => {
      void fetchSubscription();
      setIsCreateModalOpen(false);
      setIsGenerating(false);
      analytics.project.create('ai-generated');
      analytics.ai.generate({
        topic: variables.topic,
        tone: variables.tone,
        audience: variables.audience,
        length: variables.length,
        generateImages: variables.generateImages || false,
      });

      toast.success("Presentation generation started — it may take a moment to appear.", {
        description: job?.message || `Job id: ${job?.jobId || 'unknown'}`,
      });

      // if there was a search term active clear it so the new project will be visible
      setSearchQuery("");

      // begin polling for status; we avoid immediately invalidating when the job
      // completes because a subsequent refetch can overwrite our optimistic merge if
      // the backend hasn’t yet persisted the new project. instead we merge up front and
      // then perform one delayed refresh.
      if (job?.jobId) {
        let attempts = 0;
        const poll = async () => {
          attempts += 1;
          try {
            const status = await api.getProjectGenerationStatus(job.jobId);

            if (status.state === 'completed') {
              void fetchSubscription();
              if (status.result) {
                const result = status.result as Project;
                queryClient.setQueryData<Project[] | undefined>(["projects"], (old) => {
                  const existing = old as Project[] | undefined;
                  if (existing) {
                    return [result, ...existing.filter(p => p.id !== result.id)];
                  }
                  return [result];
                });

                toast.success('Your presentation is ready!', {
                  description: `"${result.title}" has been added to your list.`,
                });

                // Immediately open editor on slide 1
                router.push(`/editor/${result.id}`);
                return;
              }

              queryClient.invalidateQueries({ queryKey: ["projects"] });
              toast.success('Your presentation is ready.');
              return;
            }

            if (status.state === 'not_found') {
              // Job may not be visible in Redis for the first poll.
              if (attempts < 6) {
                setTimeout(poll, 2000);
                return;
              }
              queryClient.invalidateQueries({ queryKey: ["projects"] });
              return;
            }

            if (['failed', 'stalled', 'error'].includes(status.state)) {
              queryClient.invalidateQueries({ queryKey: ["projects"] });
              toast.error(status.failedReason || 'Presentation generation failed.');
              return;
            }

            if (attempts >= 120) {
              queryClient.invalidateQueries({ queryKey: ["projects"] });
              toast.error('Generation is taking longer than expected. Refresh the dashboard.');
              return;
            }

            setTimeout(poll, 5000);
          } catch (err) {
            const statusCode = (err as { response?: { status?: number } })
              ?.response?.status;
            if (statusCode === 404 || attempts >= 120) {
              queryClient.invalidateQueries({ queryKey: ["projects"] });
              return;
            }
            setTimeout(poll, 5000);
          }
        };
        poll();
      } else {
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    },
    onError: (error) => {
      setIsGenerating(false);
      // Limit failures never reach the worker, so AI counter is unchanged —
      // still refresh subscription so the modal stays in sync with the server.
      void fetchSubscription();
      if (isPlanLimitError(error)) {
        showPlanLimitError(error);
        return;
      }
      toast.error(generationFailureMessage(error));
    },
  });

  // Duplicate project mutation
  const duplicateProjectMutation = useMutation({
    mutationFn: (id: string) => api.projects.duplicate(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      analytics.project.duplicate(id);
      toast.success("Project duplicated");
    },
    onError: () => {
      toast.error("Failed to duplicate project");
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => api.projects.delete(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDeleteProjectId(null);
      analytics.project.delete(id);
      toast.success("Project deleted");
    },
    onError: () => {
      toast.error("Failed to delete project");
    },
  });

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    const normalizedQuery = (searchQuery || '').toLowerCase();
    const filtered = projects?.filter((p) => {
      const title = (p?.title || '').toLowerCase();
      return title.includes(normalizedQuery);
    });
    
    // Track search if there's a query
    if (normalizedQuery && filtered) {
      analytics.project.search(normalizedQuery, filtered.length);
    }
    
    return filtered;
  }, [projects, searchQuery]);

  // Deduplicate list to avoid React key warnings (shouldn't normally happen but
  // we occasionally merge the same project twice during background polling).
  const uniqueProjects = useMemo(() => {
    if (!filteredProjects) {
      return [];
    }
    const seen = new Set<string>();
    return filteredProjects.filter((p) => {
      if (seen.has(p.id)) {
        return false;
      }
      seen.add(p.id);
      return true;
    });
  }, [filteredProjects]);

  // Handle create blank project
  const handleCreateBlank = useCallback(() => {
    createProjectMutation.mutate({ title: "Untitled Presentation", type: "PRESENTATION" });
  }, [createProjectMutation]);

  const planId = (subscription?.plan || "FREE").toUpperCase();
  const planLabel =
    planId === "FREE" ? "Free" : planId === "PRO" ? "Pro" : planId === "ENTERPRISE" ? "Enterprise" : planId;
  const presentationsTotal =
    subscription?.projectsLimit ?? presentationLimit(planId);
  const aiGenerationsTotal =
    subscription?.aiGenerationsLimit ?? aiGenerationLimit(planId);
  const presentationsUsed =
    subscription?.projectsUsed ?? (projectsLoading ? undefined : projects?.length ?? 0);
  const aiGenerationsUsed = subscription?.aiGenerationsUsed ?? 0;
  const presentationsAtLimit =
    typeof presentationsUsed === "number" &&
    presentationsTotal > 0 &&
    presentationsUsed >= presentationsTotal;
  const aiAtLimit =
    aiGenerationsTotal > 0 && aiGenerationsUsed >= aiGenerationsTotal;
  // Don't flash 0/10 AI usage while subscription is still loading after reload
  const usageCardLoading =
    !subscription || (projectsLoading && subscription?.projectsUsed === undefined);

  const openCreateModal = useCallback(() => {
    void fetchSubscription();
    setIsCreateModalOpen(true);
  }, [fetchSubscription]);

  return (
    <div className="space-y-8">
      {/* Main content */}
      <div className="space-y-8">
  

        {/* Stats & Quick Actions */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <UsageCard
            plan={planLabel}
            isLoading={usageCardLoading}
            presentations={{
              used: presentationsUsed ?? 0,
              total: presentationsTotal,
            }}
            aiGenerations={{
              used: subscription?.aiGenerationsUsed ?? 0,
              total: aiGenerationsTotal,
            }}
            onUpgrade={() => router.push("/settings/billing")}
          />
          <QuickActionsGrid
            onCreateNew={() => {
              analytics.engagement.featureClick('quick_action_create_new');
              openCreateModal();
            }}
            onAIGenerate={() => {
              analytics.engagement.featureClick('quick_action_ai_generate');
              openCreateModal();
            }}
            onViewAnalytics={() => {
              analytics.engagement.featureClick('quick_action_view_analytics');
              router.push("/dashboard/analytics");
            }}
            onInviteTeam={() => {
              analytics.engagement.featureClick('quick_action_invite_team');
              if (!FEATURES.teamInvites) {
                setShowInviteComingSoon(true);
                return;
              }
              setShowInviteTeam(true);
            }}
            inviteTeamComingSoon={!FEATURES.teamInvites}
          />
        </div>

        {/* Spline hero section has been removed */}

        {/* Features Hub */}
        <FeaturesHub />

        {/* Favorites & Recent Panel */}
        {(favorites.length > 0 || recent.length > 0) && projects && (
          <div className="mb-8">
            <FavoritesRecentPanel
              projects={projects}
              favorites={favorites}
              recent={recent}
              onToggleFavorite={toggleFavorite}
              onRemoveRecent={removeFromRecent}
              onClearRecent={clearRecent}
            />
          </div>
        )}

        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Presentations</h1>
            <p className="text-slate-600 dark:text-slate-400">
              {projectsLoading ? (
                <span className="inline-block h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700 align-middle" />
              ) : (
                <>
                  {filteredProjects?.length || 0} presentation
                  {(filteredProjects?.length || 0) !== 1 ? "s" : ""}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search presentations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => {
                  setViewMode("grid");
                  analytics.engagement.viewModeChange('grid');
                }}
                className={`p-2 ${viewMode === "grid" ? "bg-slate-100 dark:bg-slate-800" : ""}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setViewMode("list");
                  analytics.engagement.viewModeChange('list');
                }}
                className={`p-2 ${viewMode === "list" ? "bg-slate-100 dark:bg-slate-800" : ""}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        {/* Projects grid/list */}
        {projectsError ? (
          <div className="text-center py-12 rounded-xl border border-dashed border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-6">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
              Failed to load presentations
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              There was an issue fetching your presentations.
            </p>
            <Button variant="outline" onClick={() => void refetchProjects()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : projectsLoading || (authLoading && !projects) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={`skel-${i}`}
                className="h-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/50 animate-pulse"
              />
            ))}
          </div>
        ) : filteredProjects?.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              {searchQuery ? "No presentations found" : "No presentations yet"}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {searchQuery
                ? "Try a different search term"
                : "Create your first presentation to get started"}
            </p>
            {!searchQuery && (
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                Create presentation
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {uniqueProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={(id) => {
                  analytics.project.open(id);
                  router.push(`/editor/${id}`);
                }}
                onEdit={(id) => {
                  analytics.project.open(id);
                  router.push(`/editor/${id}`);
                }}
                onDuplicate={(id) => duplicateProjectMutation.mutate(id)}
                onDelete={(id) => setDeleteProjectId(id)}
                isFavorite={isFavorite(project.id)}
                onToggleFavorite={(id) => {
                  const newState = !isFavorite(id);
                  toggleFavorite(id);
                  analytics.engagement.toggleFavorite(id, newState);
                }}
                variant="grid"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {uniqueProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={(id) => {
                  analytics.project.open(id);
                  router.push(`/editor/${id}`);
                }}
                onEdit={(id) => {
                  analytics.project.open(id);
                  router.push(`/editor/${id}`);
                }}
                onDuplicate={(id) => duplicateProjectMutation.mutate(id)}
                onDelete={(id) => setDeleteProjectId(id)}
                isFavorite={isFavorite(project.id)}
                onToggleFavorite={(id) => {
                  const newState = !isFavorite(id);
                  toggleFavorite(id);
                  analytics.engagement.toggleFavorite(id, newState);
                }}
                variant="list"
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateBlank={handleCreateBlank}
        onGenerate={(data) => {
          setIsGenerating(true);
          generateProjectMutation.mutate(data);
        }}
        isGenerating={isGenerating}
        planLabel={planLabel}
        presentationsUsed={presentationsUsed ?? 0}
        presentationsTotal={presentationsTotal}
        aiUsed={aiGenerationsUsed}
        aiTotal={aiGenerationsTotal}
        presentationsAtLimit={presentationsAtLimit}
        aiAtLimit={aiAtLimit}
        onUpgrade={() => router.push("/settings/billing")}
      />

      <UpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="Higher limits"
        description={upgradeDescription}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteProjectId} onOpenChange={() => setDeleteProjectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete presentation?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the presentation and all its
              slides.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProjectId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteProjectId && deleteProjectMutation.mutate(deleteProjectId)}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {FEATURES.teamInvites && (
        <InviteTeamDialog open={showInviteTeam} onOpenChange={setShowInviteTeam} />
      )}
      <ComingSoonModal
        open={showInviteComingSoon}
        onClose={() => setShowInviteComingSoon(false)}
        title="Team Invites"
        description="Team invites are coming soon."
      />

      {/* Command Palette */}
      <CommandPalette
        onNewProject={openCreateModal}
        onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={showKeyboardShortcuts}
        onOpenChange={setShowKeyboardShortcuts}
      />
    </div>
  );
}

// Create Project Modal
function CreateProjectModal({
  isOpen,
  onClose,
  onCreateBlank,
  onGenerate,
  isGenerating,
  planLabel,
  presentationsUsed,
  presentationsTotal,
  aiUsed,
  aiTotal,
  presentationsAtLimit,
  aiAtLimit,
  onUpgrade,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlank: () => void;
  onGenerate: (data: { topic: string; tone: string; audience: string; length: number; type: string; generateImages?: boolean; imageSource?: 'ai' | 'stock'; qualityMode?: boolean }) => void;
  isGenerating: boolean;
  planLabel: string;
  presentationsUsed: number;
  presentationsTotal: number;
  aiUsed: number;
  aiTotal: number;
  presentationsAtLimit: boolean;
  aiAtLimit: boolean;
  onUpgrade: () => void;
}) {
  const [mode, setMode] = useState<"select" | "generate">("select");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [audience, setAudience] = useState("general");
  const [length, setLength] = useState(10);
  const [generateImages, setGenerateImages] = useState(true);
  const [qualityMode, setQualityMode] = useState(false);

  const [generationStage, setGenerationStage] = useState<number>(0);
  useEffect(() => {
    if (!isGenerating) {
      setGenerationStage(0);
      return;
    }
    setGenerationStage(1);
    const t1 = setTimeout(() => setGenerationStage(2), 2200);
    const t2 = setTimeout(() => setGenerationStage(3), 5000);
    const t3 = setTimeout(() => setGenerationStage(4), 8500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isGenerating]);

  const generateBlocked = presentationsAtLimit || aiAtLimit;
  const limitWarning = presentationsAtLimit
    ? `You've used ${presentationsUsed} of ${presentationsTotal} presentations on the ${planLabel} plan`
    : aiAtLimit
      ? `You've used ${aiUsed} of ${aiTotal} AI credits on the ${planLabel} plan`
      : null;

  const handleGenerate = () => {
    if (generateBlocked) {
      toast.error(limitWarning || "Plan limit reached", {
        action: { label: "Upgrade", onClick: onUpgrade },
      });
      return;
    }
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }
    onGenerate({
      topic,
      tone,
      audience,
      length,
      type: "presentation",
      generateImages,
      imageSource: "stock",
      qualityMode,
    });
  };

  const handleCreateBlank = () => {
    if (presentationsAtLimit) {
      toast.error(
        `You've used ${presentationsUsed} of ${presentationsTotal} presentations on the ${planLabel} plan`,
        { action: { label: "Upgrade", onClick: onUpgrade } },
      );
      return;
    }
    onCreateBlank();
  };

  const resetForm = () => {
    setMode("select");
    setTopic("");
    setTone("professional");
    setAudience("general");
    setLength(10);
    setGenerateImages(true);
    setQualityMode(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isGenerating) {
          onClose();
          resetForm();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
        {isGenerating ? (
          <div className="py-6 px-2 text-center space-y-6">
            <div className="flex flex-col items-center">
              <div className="h-16 w-16 rounded-2xl bg-linear-to-tr from-blue-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-xl animate-pulse mb-4">
                <Sparkles className="h-8 w-8" />
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                Generating Your Presentation
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                Please wait while our AI creates and styles your deck
              </DialogDescription>
            </div>

            <div className="max-w-sm mx-auto space-y-3 text-left">
              <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${generationStage >= 1 ? 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800 opacity-50'}`}>
                {generationStage > 1 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : generationStage === 1 ? (
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">1. Outline & Structure</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Crafting narrative and talking points</p>
                </div>
              </div>

              <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${generationStage >= 2 ? 'border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/20' : 'border-slate-200 dark:border-slate-800 opacity-50'}`}>
                {generationStage > 2 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : generationStage === 2 ? (
                  <Loader2 className="h-5 w-5 text-purple-600 animate-spin shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">2. Drafting Slides & Layouts</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Formatting content into responsive columns</p>
                </div>
              </div>

              <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${generationStage >= 3 ? 'border-pink-500/50 bg-pink-50/50 dark:bg-pink-950/20' : 'border-slate-200 dark:border-slate-800 opacity-50'}`}>
                {generationStage >= 4 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : generationStage === 3 ? (
                  <Loader2 className="h-5 w-5 text-pink-600 animate-spin shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">3. Curating Images & Visuals</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Matching high-resolution editorial photography</p>
                </div>
              </div>
            </div>
          </div>
        ) : mode === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle>Create new presentation</DialogTitle>
              <DialogDescription>Choose how you want to start</DialogDescription>
            </DialogHeader>

            {limitWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{limitWarning}</p>
                  <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-300">Upgrade to create more decks and unlock higher AI quotas.</p>
                </div>
                <Button
                  size="sm"
                  className="bg-linear-to-r from-blue-600 to-purple-600 text-white shrink-0 font-medium"
                  onClick={onUpgrade}
                >
                  Upgrade
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 items-stretch bg-white dark:bg-gray-900 rounded-lg p-2">
              <button
                onClick={handleCreateBlank}
                disabled={presentationsAtLimit}
                title={presentationsAtLimit ? "Upgrade to create more presentations" : "Start with a blank presentation"}
                className="flex flex-col justify-between items-center gap-3 p-6 min-h-45 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-gray-900 shadow-md hover:shadow-lg transition-all opacity-100 h-full disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-md relative"
                type="button"
              >
                {presentationsAtLimit && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700" title="Upgrade to create more presentations">
                    <Lock className="h-3 w-3" />
                    <span>Locked</span>
                  </div>
                )}
                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-slate-900 dark:text-white">Blank</p>
                  <p className="text-sm text-slate-500">Start from scratch</p>
                </div>
              </button>

              <button
                onClick={() => setMode("generate")}
                disabled={generateBlocked}
                title={generateBlocked ? "Upgrade to create more presentations" : "Generate with Quick AI"}
                className="flex flex-col justify-between items-center gap-3 p-6 min-h-45 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-gray-900 shadow-md hover:shadow-lg transition-all opacity-100 h-full disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-md relative"
                type="button"
              >
                {generateBlocked && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700" title="Upgrade to create more presentations">
                    <Lock className="h-3 w-3" />
                    <span>Locked</span>
                  </div>
                )}
                <div className="h-12 w-12 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Wand2 className="h-6 w-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-slate-900 dark:text-white">Quick AI</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">Fast generation</p>
                </div>
              </button>

              {generateBlocked ? (
                <button
                  type="button"
                  disabled
                  title="Upgrade to create more presentations"
                  className="flex flex-col justify-between items-center gap-3 p-6 min-h-45 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-gray-900 shadow-md opacity-60 cursor-not-allowed relative overflow-hidden h-full"
                >
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700" title="Upgrade to create more presentations">
                    <Lock className="h-3 w-3" />
                    <span>Locked</span>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-slate-900 dark:text-white">AI Thinking</p>
                    <p className="text-sm text-slate-500">Premium quality</p>
                  </div>
                </button>
              ) : (
                <Link
                  href="/dashboard/ai-thinking"
                  className="flex flex-col justify-between items-center gap-3 p-6 min-h-45 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-gray-900 shadow-md hover:shadow-lg transition-all opacity-100 relative overflow-hidden h-full"
                >
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-medium">
                    NEW
                  </div>
                  <div className="h-12 w-12 rounded-full bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-slate-900 dark:text-white">AI Thinking</p>
                    <p className="text-sm text-slate-500">Premium quality</p>
                  </div>
                </Link>
              )}
            </div>

            {/* Direct Upgrade Button Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">Plan: {planLabel} ({presentationsUsed}/{presentationsTotal} presentations)</span>
              <Button size="sm" variant="outline" onClick={onUpgrade} className="border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                Upgrade Plan
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Generate with AI</DialogTitle>
              <DialogDescription>
                Describe your presentation topic and let AI create it for you
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 bg-white dark:bg-gray-900 rounded-lg">
              {limitWarning && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100 flex items-center justify-between">
                  <p className="font-medium">{limitWarning}</p>
                  <Button
                    size="sm"
                    className="bg-linear-to-r from-blue-600 to-purple-600 text-white font-medium"
                    onClick={onUpgrade}
                  >
                    Upgrade
                  </Button>
                </div>
              )}

              <div>
                <Label htmlFor="topic">Topic / Idea</Label>
                <Textarea
                  id="topic"
                  placeholder="e.g., The future of renewable energy, Benefits of remote work, Introduction to machine learning..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="mt-1.5 h-24"
                  disabled={generateBlocked}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tone">Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                      <SelectItem value="persuasive">Persuasive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="audience">Audience</Label>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="executives">Executives</SelectItem>
                      <SelectItem value="students">Students</SelectItem>
                      <SelectItem value="developers">Developers</SelectItem>
                      <SelectItem value="investors">Investors</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="length">Number of slides: {length}</Label>
                <input
                  type="range"
                  id="length"
                  min={3}
                  max={15}
                  value={length}
                  onChange={(e) => setLength(parseInt(e.target.value))}
                  className="w-full mt-1.5"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>3</span>
                  <span>15</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4 bg-white dark:bg-gray-800 dark:border-slate-800">
                <div className="space-y-0.5">
                  <Label className="text-base">Generate images</Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Add stock photography to hero, proof, and closing slides
                  </p>
                </div>
                <Switch
                  checked={generateImages}
                  onCheckedChange={setGenerateImages}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4 bg-white dark:bg-gray-800 dark:border-slate-800">
                <div className="space-y-0.5">
                  <Label className="text-base">Higher quality</Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Use the research and critic loop. Slower, denser decks.
                  </p>
                </div>
                <Switch
                  checked={qualityMode}
                  onCheckedChange={setQualityMode}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setMode("select")} disabled={isGenerating}>
                  Back
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || generateBlocked || !topic.trim()}
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
