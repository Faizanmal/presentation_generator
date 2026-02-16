"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles,
  Plus,
  Search,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  ExternalLink,
  Download,
  Loader2,
  FileText,
  Clock,
  Wand2,
  LogOut,
  Settings,
  CreditCard,
  User,
  ChevronDown,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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


export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, subscription, logout, isAuthenticated, isLoading: authLoading } = useAuthStore();
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

  // Handle logout
  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* New Design Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center py-2 px-4 shadow-sm">
        <p className="text-sm font-medium flex items-center justify-center gap-2">
          New: Try the redesigned Presentation Editor experience!
          <Link href="/dashboard-v2" className="underline hover:text-blue-100 font-bold ml-1 flex items-center">
            Switch to V2 <span className="material-symbols-outlined text-sm ml-1">arrow_forward</span>
          </Link>
        </p>
      </div>

      {/* Header */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                Presentation Designer
              </span>
            </Link>

            <div className="flex items-center gap-4">
              {/* Usage indicator */}
              {subscription && (
                <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span>
                    {subscription.aiGenerationsUsed}/{subscription.aiGenerationsLimit} AI generations
                  </span>
                  {subscription.plan === "FREE" && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/settings/billing">Upgrade</Link>
                    </Button>
                  )}
                </div>
              )}

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <span className="hidden sm:inline text-slate-700 dark:text-slate-300">
                      {user?.name}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2">
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-sm text-slate-500">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings/billing">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                onEdit={() => router.push(`/editor/${project.id}`)}
                onDuplicate={() => duplicateProjectMutation.mutate(project.id)}
                onDelete={() => setDeleteProjectId(project.id)}
                isFavorite={isFavorite(project.id)}
                onToggleFavorite={() => toggleFavorite(project.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProjects?.map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                onEdit={() => router.push(`/editor/${project.id}`)}
                onDuplicate={() => duplicateProjectMutation.mutate(project.id)}
                onDelete={() => setDeleteProjectId(project.id)}
                isFavorite={isFavorite(project.id)}
                onToggleFavorite={() => toggleFavorite(project.id)}
              />
            ))}
          </div>
        )}
      </main>

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


// Project Card Component
function ProjectCard({
  project,
  onEdit,
  onDuplicate,
  onDelete,
  isFavorite,
  onToggleFavorite,
}: {
  project: Project;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const slideCount = project._count?.slides || project.slides?.length || 0;

  return (
    <div className="group bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Thumbnail */}
      <div
        className="aspect-[16/10] bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative cursor-pointer"
        onClick={onEdit}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <FileText className="h-12 w-12 text-slate-300 dark:text-slate-600" />
        </div>
        {/* Favorite button in thumbnail */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-full transition-all ${isFavorite
            ? "bg-yellow-100 text-yellow-500"
            : "bg-white/80 text-slate-400 opacity-0 group-hover:opacity-100"
            } hover:scale-110`}
        >
          <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
        </button>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Button size="sm" variant="secondary">
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-slate-900 dark:text-white truncate">{project.title}</h3>
            <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
              <Clock className="h-3 w-3" />
              {new Date(project.updatedAt).toLocaleDateString()}
              <span>•</span>
              {slideCount} slide{slideCount !== 1 ? "s" : ""}
            </p>
          </div>


          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ExternalLink className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// Project List Item Component
function ProjectListItem({
  project,
  onEdit,
  onDuplicate,
  onDelete,
  isFavorite,
  onToggleFavorite,
}: {
  project: Project;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const slideCount = project._count?.slides || project.slides?.length || 0;

  return (
    <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className="h-16 w-24 bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded flex items-center justify-center flex-shrink-0 relative">
        <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
      </div>

      {/* Favorite button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={`p-1.5 rounded-full transition-all ${isFavorite
          ? "text-yellow-500"
          : "text-slate-300 hover:text-yellow-500"
          }`}
      >
        <Star className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} />
      </button>

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-slate-900 dark:text-white truncate">{project.title}</h3>
        <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
          <Clock className="h-3 w-3" />
          {new Date(project.updatedAt).toLocaleDateString()}
          <span>•</span>
          {slideCount} slide{slideCount !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ExternalLink className="mr-2 h-4 w-4" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Download className="mr-2 h-4 w-4" />
              Export
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
