"use client";

import { useState, useEffect } from "react";
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
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input }
  from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { Project } from "@/types";

// New usability components
import { CommandPalette } from "@/components/ui/command-palette";
import { KeyboardShortcutsDialog } from "@/components/ui/keyboard-shortcuts";
import {
  useFavorites,
  useRecentProjects,
  FavoritesRecentPanel,
} from "@/components/ui/favorites-recent";
import { FeaturesHub } from "@/components/dashboard/features-hub";
import {
  StatCard,
  StatsGrid,
  QuickActionsGrid,
  UsageCard
} from "@/components/ui/dashboard-widgets";
import { ProjectCard } from "@/components/ui/project-card";


export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, subscription, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Create Project Modal

  // Favorites and recent projects
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { recent, removeFromRecent, clearRecent } = useRecentProjects();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);


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
    onSuccess: (job) => {
      // Backend enqueues the generation job. do NOT assume a project object is returned.
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsCreateModalOpen(false);
      setIsGenerating(false);
      toast.success("Presentation generation started — we'll notify you when it's ready.", {
        description: job?.message || `Job id: ${job?.jobId || 'unknown'}`,
      });
      // Do NOT redirect to `/editor/${undefined}` — user can open the project once generation completes
    },
    onError: () => {
      toast.error("Failed to generate presentation");
      setIsGenerating(false);
    },
  });

  // Duplicate project mutation
  const duplicateProjectMutation = useMutation({
    mutationFn: (id: string) => api.projects.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project duplicated");
    },
    onError: () => {
      toast.error("Failed to duplicate project");
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => api.projects.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDeleteProjectId(null);
      toast.success("Project deleted");
    },
    onError: () => {
      toast.error("Failed to delete project");
    },
  });

  // Filter projects by search
  const filteredProjects = projects?.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle create blank project
  const handleCreateBlank = () => {
    createProjectMutation.mutate({ title: "Untitled Presentation", type: "PRESENTATION" });
  };



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
        {/* V2 Experience Card */}
        <div className="bg-white dark:bg-slate-950 rounded-xl border border-blue-200 dark:border-slate-800 p-6 mb-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative z-10">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Try the New V2 Experience
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-2xl">
              We've redesigned the interface to be more intuitive, powerful, and beautiful. Switch to the new views to experience the future of presentation design.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/dashboard-v2">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0">
                  <LayoutGrid className="mr-2 h-5 w-5" />
                  Go to Dashboard V2
                </Button>
              </Link>

              <Button
                size="lg"
                variant="outline"
                className="border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={() => {
                  if (projects && projects.length > 0) {
                    router.push(`/editor-v2/${projects[0].id}`);
                  } else {
                    toast.error("Please create a project first to try the editor");
                  }
                }}
              >
                <Pencil className="mr-2 h-5 w-5 text-blue-600" />
                Open Editor V2
              </Button>
            </div>
          </div>
        </div>

        {/* Stats & Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <UsageCard
            plan={subscription?.plan || "free"}
            presentations={{ used: projects?.length || 0, total: 100 }} // Mock limit
            aiGenerations={{ used: subscription?.aiGenerationsUsed || 0, total: subscription?.aiGenerationsLimit || 10 }}
          />
          <QuickActionsGrid
            onCreateNew={() => setIsCreateModalOpen(true)}
            onAIGenerate={() => {
              setIsCreateModalOpen(true);
              // Pre-select AI mode could be implemented here
            }}
            onViewAnalytics={() => router.push("/dashboard/analytics")}
            onInviteTeam={() => toast.info("Team invitation coming soon!")}
          />
        </div>

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
                onClick={() => setViewMode("grid")}
                className={`p-2 ${viewMode === "grid" ? "bg-slate-100 dark:bg-slate-800" : ""}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
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
            {filteredProjects?.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={(id) => router.push(`/editor/${id}`)}
                onEdit={(id) => router.push(`/editor/${id}`)}
                onDuplicate={(id) => duplicateProjectMutation.mutate(id)}
                onDelete={(id) => setDeleteProjectId(id)}
                isFavorite={isFavorite(project.id)}
                onToggleFavorite={(id) => toggleFavorite(id)}
                variant="grid"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProjects?.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={(id) => router.push(`/editor/${id}`)}
                onEdit={(id) => router.push(`/editor/${id}`)}
                onDuplicate={(id) => duplicateProjectMutation.mutate(id)}
                onDelete={(id) => setDeleteProjectId(id)}
                isFavorite={isFavorite(project.id)}
                onToggleFavorite={(id) => toggleFavorite(id)}
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
      <DialogContent className="sm:max-w-lg">
        {mode === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle>Create new presentation</DialogTitle>
              <DialogDescription>Choose how you want to start</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
              <button
                onClick={onCreateBlank}
                className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
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
                className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors"
                type="button"
              >
                <div className="h-12 w-12 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Wand2 className="h-6 w-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-slate-900 dark:text-white">Quick AI</p>
                  <p className="text-sm text-slate-500">Fast generation</p>
                </div>
              </button>

              <Link
                href="/dashboard/ai-thinking"
                className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors relative overflow-hidden"
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

            <div className="space-y-4 py-4">
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

              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-800">
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}



