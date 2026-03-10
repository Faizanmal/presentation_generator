"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Puzzle,
  ChevronLeft,
  Loader2,
  Search,
  Download,
  Trash2,
  Star,
  ToggleLeft,
  ToggleRight,
  Store,
  Package,
  Code,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";

export default function PluginSystemPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("marketplace");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState("popular");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewPluginId, setReviewPluginId] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  // Marketplace search
  const { data: marketplaceData, isLoading: marketLoading } = useQuery({
    queryKey: ["plugins-marketplace", searchQuery, category, sortBy],
    queryFn: () =>
      api.plugins.search({
        q: searchQuery || undefined,
        category: category || undefined,
        sort: sortBy,
        limit: 20,
      }),
  });

  // Installed plugins
  const { data: installedPlugins, isLoading: installedLoading } = useQuery({
    queryKey: ["plugins-installed"],
    queryFn: () => api.plugins.getInstalled(),
  });

  // Install plugin
  const installMut = useMutation({
    mutationFn: (pluginId: string) => api.plugins.install(pluginId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins-installed"] });
      toast.success("Plugin installed!");
    },
    onError: () => toast.error("Failed to install plugin"),
  });

  // Uninstall plugin
  const uninstallMut = useMutation({
    mutationFn: (installationId: string) =>
      api.plugins.uninstall(installationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins-installed"] });
      toast.success("Plugin uninstalled");
    },
    onError: () => toast.error("Failed to uninstall plugin"),
  });

  // Toggle plugin
  const toggleMut = useMutation({
    mutationFn: (installationId: string) =>
      api.plugins.toggle(installationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins-installed"] });
      toast.success("Plugin toggled");
    },
    onError: () => toast.error("Failed to toggle plugin"),
  });

  // Submit review
  const reviewMut = useMutation({
    mutationFn: ({
      pluginId,
      rating,
      comment,
    }: {
      pluginId: string;
      rating: number;
      comment: string;
    }) => api.plugins.submitReview(pluginId, { rating, comment }),
    onSuccess: () => {
      setReviewDialogOpen(false);
      setReviewComment("");
      setReviewRating(5);
      toast.success("Review submitted");
    },
    onError: () => toast.error("Failed to submit review"),
  });

  const isInstalled = (pluginId: string) =>
    installedPlugins?.some(
      (ip: { pluginId: string }) => ip.pluginId === pluginId
    );

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Puzzle className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  Plugins
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="marketplace">
              <Store className="h-4 w-4 mr-1" /> Marketplace
            </TabsTrigger>
            <TabsTrigger value="installed">
              <Package className="h-4 w-4 mr-1" /> Installed
              {installedPlugins?.length ? (
                <Badge variant="secondary" className="ml-2">
                  {installedPlugins.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {/* Marketplace */}
          <TabsContent value="marketplace">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search plugins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="themes">Themes</SelectItem>
                  <SelectItem value="blocks">Blocks</SelectItem>
                  <SelectItem value="integrations">Integrations</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                  <SelectItem value="ai">AI</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Popular</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {marketLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !marketplaceData?.plugins?.length ? (
              <div className="text-center py-12">
                <Puzzle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">No plugins found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {marketplaceData.plugins.map(
                  (plugin: {
                    id: string;
                    name: string;
                    description: string;
                    version: string;
                    author?: string;
                    category?: string;
                    rating?: number;
                    downloadCount?: number;
                    iconUrl?: string;
                  }) => (
                    <Card key={plugin.id} className="flex flex-col">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                              {plugin.iconUrl ? (
                                <Image
                                  src={plugin.iconUrl}
                                  alt={plugin.name}
                                  className="h-6 w-6"
                                />
                              ) : (
                                <Code className="h-5 w-5 text-violet-600" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-base">
                                {plugin.name}
                              </CardTitle>
                              {plugin.author && (
                                <CardDescription className="text-xs">
                                  by {plugin.author}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                          {plugin.category && (
                            <Badge variant="secondary" className="text-xs">
                              {plugin.category}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {plugin.description}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          {plugin.rating != null && (
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{" "}
                              {plugin.rating.toFixed(1)}
                            </span>
                          )}
                          {plugin.downloadCount != null && (
                            <span className="flex items-center gap-1">
                              <Download className="h-3 w-3" />{" "}
                              {plugin.downloadCount.toLocaleString()}
                            </span>
                          )}
                          <span>v{plugin.version}</span>
                        </div>
                      </CardContent>
                      <CardFooter>
                        {isInstalled(plugin.id) ? (
                          <Badge>Installed</Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => installMut.mutate(plugin.id)}
                            disabled={installMut.isPending}
                          >
                            {installMut.isPending ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3 mr-1" />
                            )}
                            Install
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  )
                )}
              </div>
            )}
          </TabsContent>

          {/* Installed */}
          <TabsContent value="installed">
            {installedLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !installedPlugins?.length ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">No Plugins Installed</h3>
                <p className="text-muted-foreground mb-4">
                  Browse the marketplace to find plugins.
                </p>
                <Button onClick={() => setActiveTab("marketplace")}>
                  <Store className="h-4 w-4 mr-2" /> Browse Marketplace
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {installedPlugins.map(
                  (install: {
                    id: string;
                    pluginId: string;
                    pluginName: string;
                    pluginVersion: string;
                    enabled: boolean;
                    installedAt: string;
                  }) => (
                    <Card key={install.id}>
                      <CardContent className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                            <Code className="h-5 w-5 text-violet-600" />
                          </div>
                          <div>
                            <h3 className="font-medium">
                              {install.pluginName}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              v{install.pluginVersion} &middot; Installed{" "}
                              {new Date(
                                install.installedAt
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              install.enabled ? "default" : "secondary"
                            }
                          >
                            {install.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleMut.mutate(install.id)}
                            title={
                              install.enabled ? "Disable" : "Enable"
                            }
                          >
                            {install.enabled ? (
                              <ToggleRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReviewPluginId(install.pluginId);
                              setReviewDialogOpen(true);
                            }}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Uninstall Plugin?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove the plugin and its data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    uninstallMut.mutate(install.id)
                                  }
                                >
                                  Uninstall
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Review</DialogTitle>
              <DialogDescription>
                Rate and review this plugin
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Rating</label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setReviewRating(r)}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          r <= reviewRating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Comment</label>
                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Write your review..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() =>
                  reviewMut.mutate({
                    pluginId: reviewPluginId,
                    rating: reviewRating,
                    comment: reviewComment,
                  })
                }
                disabled={reviewMut.isPending}
              >
                {reviewMut.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Submit Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
