"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Loader2,
    FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
import { FeaturesHub } from "@/components/dashboard/features-hub";

// New usability components
import { CommandPalette } from "@/components/ui/command-palette";
import { KeyboardShortcutsDialog } from "@/components/ui/keyboard-shortcuts";
import {
    useFavorites,
    useRecentProjects,
} from "@/components/ui/favorites-recent";

export default function DashboardPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user, subscription, logout, isAuthenticated, isLoading: authLoading } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const [heroTopic, setHeroTopic] = useState("");

    // Favorites and recent projects
    const { toggleFavorite, isFavorite } = useFavorites();
    const { recent: _recent } = useRecentProjects();

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
            router.push(`/editor-v2/${project.id}`);
        },
        onError: () => {
            toast.error("Failed to create project");
        },
    });

    // Generate project mutation
    const generateProjectMutation = useMutation({
        mutationFn: (data: { topic: string; tone: string; audience: string; length: number; type: string; generateImages?: boolean; imageSource?: 'ai' | 'stock' }) =>
            api.projects.generateAndCreate(data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            setIsCreateModalOpen(false);
            setIsGenerating(false);

            // Result from generateAndCreateProject contains projectId directly
            if (result.projectId) {
                toast.success("Presentation generated!");
                router.push(`/editor-v2/${result.projectId}`);
            } else {
                toast.error("Failed to get project ID");
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

    // Filter starred projects
    const starredProjects = projects?.filter((p) => isFavorite(p.id));

    // Filter recent projects



    // Handle create blank project
    const handleCreateBlank = () => {
        createProjectMutation.mutate({ title: "Untitled Presentation", type: "PRESENTATION" });
    };

    const handleHeroGenerate = () => {
        if (heroTopic.trim()) {
            setIsCreateModalOpen(true);
        } else {
            toast.error("Please describe your topic first");
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="flex w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                <div className="flex h-full flex-col justify-between p-4">
                    <div className="flex flex-col gap-6">
                        {/* Brand */}
                        <div className="flex items-center gap-3 px-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                                <span className="material-symbols-outlined text-xl" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-base font-bold leading-none dark:text-white">SlideGen AI</h1>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Pro Workspace</p>
                            </div>
                        </div>
                        {/* Navigation */}
                        <nav className="flex flex-col gap-1">
                            <Link className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 text-blue-600 dark:bg-slate-800 dark:text-white" href="/dashboard-v2">
                                {/* <span className="material-symbols-outlined filled">home</span> */}
                                <span className="text-sm font-medium">Home</span>
                            </Link>
                            <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors" href="/dashboard-v2">
                                {/* <span className="material-symbols-outlined">grid_view</span> */}
                                <span className="text-sm font-medium">Presentations</span>
                            </Link>
                            <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors" href="/marketplace">
                                {/* <span className="material-symbols-outlined">style</span> */}
                                <span className="text-sm font-medium">Templates</span>
                            </Link>
                            <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors" href="/dashboard/analytics">
                                {/* <span className="material-symbols-outlined">bar_chart</span> */}
                                <span className="text-sm font-medium">Analytics</span>
                            </Link>
                            <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors" href="/settings">
                                {/* <span className="material-symbols-outlined">settings</span> */}
                                <span className="text-sm font-medium">Settings</span>
                            </Link>
                        </nav>
                    </div>
                    {/* Bottom Actions */}
                    <div className="flex flex-col gap-4">
                        {/* Usage Meter */}
                        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                            <div className="mb-2 flex justify-between text-xs font-medium">
                                <span className="text-slate-600 dark:text-slate-300">AI Credits</span>
                                <span className="text-blue-600">{subscription?.aiGenerationsUsed || 0}/{subscription?.aiGenerationsLimit || 50} Used</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                <div
                                    className="h-full rounded-full bg-blue-600"
                                    style={{ width: `${Math.min(100, ((subscription?.aiGenerationsUsed || 0) / (subscription?.aiGenerationsLimit || 50)) * 100)}%` }}
                                />
                            </div>
                            <button className="mt-3 w-full text-xs font-semibold text-blue-600 hover:text-blue-400 text-left">Upgrade Plan →</button>
                        </div>
                        {/* User Profile (Mini) */}
                        <div className="flex items-center gap-3 px-1">
                            <div className="h-8 w-8 rounded-full bg-cover bg-center flex items-center justify-center bg-slate-200 text-slate-600 text-xs font-bold">
                                {user?.name?.charAt(0) || "U"}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium dark:text-white truncate max-w-[100px]">{user?.name || "User"}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">{subscription?.plan || "Free"} Plan</span>
                            </div>
                            <button onClick={logout} className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-white" title="Logout">
                                <span className="material-symbols-outlined text-lg">logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden relative bg-slate-50 dark:bg-slate-900">
                {/* Header */}
                <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white hidden sm:block">Dashboard</h2>
                        <Link href="/dashboard" className="text-xs text-slate-500 hover:text-blue-600 hover:underline">Switch to Classic View</Link>
                    </div>
                    {/* Search Bar */}
                    <div className="mx-4 flex max-w-md flex-1 items-center justify-center">
                        <div className="relative w-full">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                {/* <span className="material-symbols-outlined text-xl">search</span> */}
                            </span>
                            <input
                                className="h-10 w-full rounded-lg border-none bg-slate-100 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-400"
                                placeholder="Search presentations (⌘K)"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    {/* Header Actions */}
                    <div className="flex items-center gap-3">
                        <button className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white relative">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-slate-950" />
                        </button>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="hidden sm:flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                            <span>New Deck</span>
                        </button>
                    </div>
                </header>

                <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-[1600px] mx-auto w-full">
                    {/* Hero Generator Section */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 px-8 py-12 text-center shadow-xl dark:from-slate-800 dark:to-slate-950 border border-slate-200 dark:border-slate-800">
                        {/* Background Decoration */}
                        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                            <div className="absolute -top-[50%] -left-[10%] w-[70%] h-[150%] rounded-full bg-blue-600 blur-[120px]" />
                            <div className="absolute top-[20%] -right-[10%] w-[50%] h-[100%] rounded-full bg-purple-600 blur-[100px]" />
                        </div>
                        <div className="relative z-10 mx-auto max-w-3xl flex flex-col items-center gap-6">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm border border-white/10">
                                <span className="material-symbols-outlined text-sm text-yellow-400">colors_spark</span>
                                AI Powered v2.0
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                                What would you like to present today?
                            </h1>
                            <p className="text-lg text-slate-300 max-w-xl">
                                Describe your topic and let our AI build the structure, content, and design for you in seconds.
                            </p>
                            <div className="relative mt-4 w-full max-w-2xl">
                                <div className="flex w-full items-center overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-blue-600 dark:bg-slate-800 dark:ring-white/10">
                                    <div className="pl-4 text-slate-400 dark:text-slate-500">
                                        <span className="material-symbols-outlined" />
                                    </div>
                                    <input
                                        className="h-14 w-full border-none bg-transparent px-4 text-base text-slate-900 placeholder-slate-400 focus:ring-0 dark:text-white dark:placeholder-slate-500 outline-none"
                                        placeholder="e.g., A pitch deck for a fintech startup raising Series A..."
                                        type="text"
                                        value={heroTopic}
                                        onChange={(e) => setHeroTopic(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleHeroGenerate()}
                                    />
                                    <button
                                        onClick={handleHeroGenerate}
                                        className="m-1.5 hidden h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white transition-transform hover:scale-105 hover:bg-blue-700 sm:flex"
                                    >
                                        Generate
                                        {/* <span className="material-symbols-outlined text-lg">arrow_forward</span> */}
                                    </button>
                                </div>
                                <button
                                    onClick={handleHeroGenerate}
                                    className="mt-2 w-full sm:hidden rounded-lg bg-blue-600 py-3 font-semibold text-white shadow-lg"
                                >
                                    Generate Deck
                                </button>
                            </div>
                            <div className="mt-4 flex flex-wrap justify-center gap-3">
                                <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors">
                                    <span className="material-symbols-outlined text-sm">upload_file</span>
                                </button>
                                <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors">
                                    <span className="material-symbols-outlined text-sm">link</span>
                                </button>
                                <button
                                    onClick={handleCreateBlank}
                                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm" />
                                    Start Blank
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Features Hub */}
                    <FeaturesHub />

                    {/* Starred Section */}
                    {starredProjects && starredProjects.length > 0 && (
                        <section>
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                                    <span className="material-symbols-outlined text-yellow-500 fill-current">star</span>
                                    Starred Presentations
                                </h3>
                                <Link className="text-sm font-medium text-blue-600 hover:text-blue-400" href="#">View All</Link>
                            </div>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                {starredProjects.map(project => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        onEdit={() => router.push(`/editor-v2/${project.id}`)}
                                        onDuplicate={() => duplicateProjectMutation.mutate(project.id)}
                                        onDelete={() => setDeleteProjectId(project.id)}
                                        isFavorite
                                        onToggleFavorite={() => toggleFavorite(project.id)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Recent Presentations */}
                    <section>
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-slate-400">history</span>
                                Recent Presentations
                            </h3>
                            {/* Filter Tabs */}
                            <div className="hidden md:flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                                <button className="rounded px-3 py-1 text-xs font-semibold bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white">All</button>
                                <button className="rounded px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Owned by me</button>
                                <button className="rounded px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Shared with me</button>
                            </div>
                        </div>

                        {projectsLoading ? (
                            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {filteredProjects?.map(project => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        onEdit={() => router.push(`/editor-v2/${project.id}`)}
                                        onDuplicate={() => duplicateProjectMutation.mutate(project.id)}
                                        onDelete={() => setDeleteProjectId(project.id)}
                                        isFavorite={isFavorite(project.id)}
                                        onToggleFavorite={() => toggleFavorite(project.id)}
                                    />
                                ))}
                                {filteredProjects?.length === 0 && (
                                    <div className="col-span-full text-center py-10 text-slate-500">
                                        No presentations found.
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Analytics Teaser */}
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Weekly Analytics</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Your decks are getting noticed.</p>
                            </div>
                            <Link href="/dashboard/analytics" className="text-sm font-semibold text-blue-600 hover:text-blue-400">View detailed analytics →</Link>
                        </div>
                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Views</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">1,240 <span className="text-sm font-normal text-green-500">↑ 12%</span></p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Unique Visitors</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">856 <span className="text-sm font-normal text-green-500">↑ 8%</span></p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Avg. Time Spent</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">4m 12s <span className="text-sm font-normal text-slate-400">− 2%</span></p>
                            </div>
                        </div>
                    </section>
                </div>
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
                initialTopic={heroTopic}
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
    return (
        <div className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
            <div
                className="relative aspect-video w-full bg-slate-100 dark:bg-slate-900 cursor-pointer"
                onClick={onEdit}
            >
                <div className="absolute inset-0 flex items-center justify-center">
                    <FileText className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                </div>
                {/* If we had a thumbnail URL, we would use it here */}

                <div className="absolute right-2 top-2 rounded-full bg-black/40 p-1 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
                        <span className={`material-symbols-outlined text-sm ${isFavorite ? "text-yellow-400" : "text-white"}`}>star</span>
                    </button>
                </div>
            </div>
            <div className="flex flex-1 flex-col p-4">
                <h4 className="mb-1 font-semibold text-slate-900 dark:text-white truncate">{project.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Edited {new Date(project.updatedAt).toLocaleDateString()}</p>
                <div className="mt-4 flex items-center gap-2">
                    <button
                        onClick={onEdit}
                        className="flex-1 rounded bg-slate-100 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    >
                        Edit
                    </button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:text-white">
                                <span className="material-symbols-outlined text-lg">more_horiz</span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
                            <DropdownMenuItem onClick={onDelete} className="text-red-600">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
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
    initialTopic = "",
}: {
    isOpen: boolean;
    onClose: () => void;
    onCreateBlank: () => void;
    onGenerate: (data: { topic: string; tone: string; audience: string; length: number; type: string; generateImages?: boolean; imageSource?: 'ai' | 'stock' }) => void;
    isGenerating: boolean;
    initialTopic?: string;
}) {
    const [mode, setMode] = useState<"select" | "generate">(initialTopic ? "generate" : "select");
    const [topic, setTopic] = useState(initialTopic);
    const [tone, setTone] = useState("professional");
    const [audience, setAudience] = useState("general");
    const [length, setLength] = useState(5);
    const [generateImages, setGenerateImages] = useState(false);

    const [prevInitialTopic, setPrevInitialTopic] = useState(initialTopic);

    if (initialTopic !== prevInitialTopic && isOpen) {
        setPrevInitialTopic(initialTopic);
        setTopic(initialTopic);
        setMode("generate");
    }

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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
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
                                <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white">auto_awesome</span>
                                </div>
                                <div className="text-center">
                                    <p className="font-medium text-slate-900 dark:text-white">Quick AI</p>
                                    <p className="text-sm text-slate-500">Fast generation</p>
                                </div>
                            </button>
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
                                    placeholder="e.g., The future of renewable energy..."
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
                                        <span className="material-symbols-outlined text-lg mr-2">auto_awesome</span>
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
