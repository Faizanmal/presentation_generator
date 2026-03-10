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
import { analytics } from "@/lib/analytics";
import type { Project } from "@/types";

// Dynamically import heavy/secondary components for performance
const CommandPalette = dynamic(() => import("@/components/ui/command-palette").then(mod => mod.CommandPalette), { ssr: false });
const KeyboardShortcutsDialog = dynamic(() => import("@/components/ui/keyboard-shortcuts").then(mod => mod.KeyboardShortcutsDialog), { ssr: false });
const FavoritesRecentPanel = dynamic(() => import("@/components/ui/favorites-recent").then(mod => mod.FavoritesRecentPanel), { ssr: false });
const FeaturesHub = dynamic(() => import("@/components/dashboard/features-hub").then(mod => mod.FeaturesHub), { ssr: false });
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authLoading = useAuthStore((state) => state.isLoading);
  const initialized = useAuthStore((state) => state.initialized);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Favorites and recent projects
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { recent, removeFromRecent, clearRecent } = useRecentProjects();

  // Redirect if not authenticated
  useEffect(() => {
    if (initialized && !authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, initialized, router]);

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.projects.getAll(),
    enabled: isAuthenticated,
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: (data: { title: string; type: string }) => api.projects.create(data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      analytics.project.create('blank');
      router.push(`/editor/${project.id}`);
    },
    onError: () => {
      toast.error("Failed to create project");
    },
  });

  // Generate project mutation
  const generateProjectMutation = useMutation({
    mutationFn: (data: { topic: string; tone: string; audience: string; length: number; type: string; generateImages?: boolean; imageSource?: 'ai' | 'stock' }) =>
      api.projects.generate(data),
    onSuccess: (job, variables) => {
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
        const poll = async () => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const status = await (api as any).getProjectGenerationStatus(job.jobId);

            if (status.state === 'completed') {
              if (status.result) {
                // update cache now so the project appears regardless of later refetches
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

                // give the backend a moment to finish storing before refetching. after
                // the refetch completes we merge the same result again so it can’t be
                // wiped out if the server response didn’t include it yet.
                setTimeout(() => {
                  queryClient
                    .invalidateQueries({ queryKey: ["projects"] })
                    .then(() => {
                      queryClient.setQueryData<Project[] | undefined>(["projects"], (old) => {
                        const existing = old as Project[] | undefined;
                        if (existing) {
                          return [result, ...existing.filter(p => p.id !== result.id)];
                        }
                        return [result];
                      });
                    });
                }, 3000);

                // stop polling now that we handled completion
                return;
              } else {
                // job finished but result not attached yet – try again shortly
                setTimeout(poll, 2000);
                return;
              }
            }

            if (['failed', 'stalled', 'error'].includes(status.state)) {
              // a failure should still refresh the list so stale jobs don’t linger
              queryClient.invalidateQueries({ queryKey: ["projects"] });
              toast.error('Presentation generation failed.');
              return;
            }

            // still queued/running, poll again
            setTimeout(poll, 5000);
          } catch (_err) {
            // transient error – retry
            setTimeout(poll, 5000);
          }
        };
        poll();
      } else {
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    },
    onError: () => {
      toast.error("Failed to generate presentation");
      setIsGenerating(false);
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Main content */}
      <div className="space-y-8">
  

        {/* Stats & Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <UsageCard
            plan={subscription?.plan || "free"}
            presentations={{ used: projects?.length || 0, total: subscription?.presentationLimit || (subscription?.plan === 'ENTERPRISE' ? 10000 : subscription?.plan === 'PRO' ? 500 : 10) }}
            aiGenerations={{ used: subscription?.aiGenerationsUsed || 0, total: subscription?.aiGenerationsLimit || 10 }}
          />
          <QuickActionsGrid
            onCreateNew={() => {
              analytics.engagement.featureClick('quick_action_create_new');
              setIsCreateModalOpen(true);
            }}
            onAIGenerate={() => {
              analytics.engagement.featureClick('quick_action_ai_generate');
              setIsCreateModalOpen(true);
            }}
            onViewAnalytics={() => {
              analytics.engagement.featureClick('quick_action_view_analytics');
              router.push("/dashboard/analytics");
            }}
            onInviteTeam={() => {
              analytics.engagement.featureClick('quick_action_invite_team');
              toast.info("Team invitation coming soon!");
            }}
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
              {filteredProjects?.length || 0} presentation{(filteredProjects?.length || 0) !== 1 ? "s" : ""}
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

            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        {/* Projects grid/list */}
        {projectsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
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
              <Button onClick={() => setIsCreateModalOpen(true)}>
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

      {/* Command Palette */}
      <CommandPalette
        onNewProject={() => setIsCreateModalOpen(true)}
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
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlank: () => void;
  onGenerate: (data: { topic: string; tone: string; audience: string; length: number; type: string; generateImages?: boolean; imageSource?: 'ai' | 'stock' }) => void;
  isGenerating: boolean;
}) {
  const [mode, setMode] = useState<"select" | "generate">("select");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [audience, setAudience] = useState("general");
  const [length, setLength] = useState(5);
  const [generateImages, setGenerateImages] = useState(false);

  const handleGenerate = () => {
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
      imageSource: "ai"
    });
  };

  const resetForm = () => {
    setMode("select");
    setTopic("");
    setTone("professional");
    setAudience("general");
    setLength(5);
    setGenerateImages(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          resetForm();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-900">
        {mode === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle>Create new presentation</DialogTitle>
              <DialogDescription>Choose how you want to start</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 items-stretch bg-white dark:bg-gray-900 rounded-lg p-2">
              {/* make cards fully opaque with explicit light/dark backgrounds and stronger hover shadows */}
              <button
                onClick={onCreateBlank}
                className="flex flex-col justify-between items-center gap-3 p-6 min-h-45 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-gray-900 shadow-md hover:shadow-lg transition-all opacity-100 h-full"
                type="button"
              >
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
                className="flex flex-col justify-between items-center gap-3 p-6 min-h-45 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-gray-900 shadow-md hover:shadow-lg transition-all opacity-100 h-full"
                type="button"
              >
                <div className="h-12 w-12 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Wand2 className="h-6 w-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-slate-900 dark:text-white">Quick AI</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">Fast generation</p>
                </div>
              </button>

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

            {/* wrap generation form in a solid card so the overlay doesn’t show through */}
            <div className="space-y-4 py-4 bg-white dark:bg-gray-900 rounded-lg">
              <div>
                <Label htmlFor="topic">Topic / Idea</Label>
                <Textarea
                  id="topic"
                  placeholder="e.g., The future of renewable energy, Benefits of remote work, Introduction to machine learning..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="mt-1.5 h-24"
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
                      <SelectItem value="inspirational">Inspirational</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
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
                  <Label className="text-base">Generate Images</Label>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Use AI to generate relevant images for each slide
                  </p>
                </div>
                <Switch
                  checked={generateImages}
                  onCheckedChange={setGenerateImages}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setMode("select")} disabled={isGenerating}>
                  Back
                </Button>
                <Button onClick={handleGenerate} disabled={isGenerating || !topic.trim()}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
