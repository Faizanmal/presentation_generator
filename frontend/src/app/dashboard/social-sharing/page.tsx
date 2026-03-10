"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Share2,
  Link2,
  Copy,
  ChevronLeft,
  Loader2,
  ExternalLink,
  Eye,
  MousePointerClick,
  Twitter,
  Linkedin,
  Facebook,
  Plus,
  Trash2,
  Globe,
  Check,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { api } from "@/lib/api";

export default function SocialSharingPage() {
  const queryClient = useQueryClient();
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [linkSettings, setLinkSettings] = useState({
    platform: "general",
    isPublic: true,
    expiresIn: "never",
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch user's projects
  const { data: projects } = useQuery({
    queryKey: ["projects-for-share"],
    queryFn: () => api.projects.getAll(),
  });

  // Fetch share links
  const { data: shareLinks, isLoading: linksLoading } = useQuery({
    queryKey: ["share-links"],
    queryFn: () => api.socialSharing.getShareLinks(),
  });

  // Fetch sharing stats
  const { data: sharingStats } = useQuery({
    queryKey: ["sharing-stats"],
    queryFn: () => api.socialSharing.getStats(),
  });

  // Create share link mutation
  const createLinkMutation = useMutation({
    mutationFn: (data: {
      projectId: string;
      platform: string;
      isPublic: boolean;
      expiresIn?: string;
    }) => api.socialSharing.createShareLink(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share-links"] });
      queryClient.invalidateQueries({ queryKey: ["sharing-stats"] });
      setIsCreateLinkOpen(false);
      setSelectedProjectId("");
      toast.success("Share link created!");
    },
    onError: () => toast.error("Failed to create share link"),
  });

  // Delete share link mutation
  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: string) => api.socialSharing.deleteShareLink(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share-links"] });
      toast.success("Share link removed");
    },
    onError: () => toast.error("Failed to delete share link"),
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Link copied to clipboard!");
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "twitter":
        return <Twitter className="h-4 w-4" />;
      case "linkedin":
        return <Linkedin className="h-4 w-4" />;
      case "facebook":
        return <Facebook className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-pink-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
                <div className="h-8 w-8 rounded-lg bg-linear-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                  <Share2 className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  Social Sharing
                </span>
              </div>
            </div>
            <Button onClick={() => setIsCreateLinkOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Share Link
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Links</p>
                  <p className="text-2xl font-bold">
                    {sharingStats?.totalLinks ?? 0}
                  </p>
                </div>
                <Link2 className="h-8 w-8 text-pink-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Views</p>
                  <p className="text-2xl font-bold">
                    {sharingStats?.totalViews ?? 0}
                  </p>
                </div>
                <Eye className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Shares</p>
                  <p className="text-2xl font-bold">
                    {sharingStats?.totalShares ?? 0}
                  </p>
                </div>
                <MousePointerClick className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Share Links */}
        <Card>
          <CardHeader>
            <CardTitle>Share Links</CardTitle>
            <CardDescription>
              Manage your presentation share links across platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linksLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !shareLinks?.length ? (
              <div className="text-center py-12">
                <Share2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">No Share Links</h3>
                <p className="text-muted-foreground mb-4">
                  Create a share link to share your presentations.
                </p>
                <Button onClick={() => setIsCreateLinkOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Create Share Link
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {shareLinks.map(
                  (link: {
                    id: string;
                    url: string;
                    platform: string;
                    projectTitle?: string;
                    views?: number;
                    clicks?: number;
                    isPublic?: boolean;
                    isActive?: boolean;
                    createdAt: string;
                    expiresAt?: string;
                  }) => {
                    return (
                    <div
                      key={link.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800">
                        {getPlatformIcon(link.platform)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {link.projectTitle || "Presentation"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {link.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {link.views ?? 0}
                        </span>
                        {link.clicks != null && (
                          <span className="flex items-center gap-1">
                            <MousePointerClick className="h-3 w-3" />{" "}
                            {link.clicks}
                          </span>
                        )}
                      </div>
                      <Badge
                        variant={(link.isActive ?? link.isPublic) ? "default" : "secondary"}
                      >
                        {(link.isActive ?? link.isPublic) ? "Active" : "Expired"}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(link.url, link.id)
                          }
                        >
                          {copiedId === link.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            window.open(link.url, "_blank")
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600"
                          onClick={() =>
                            deleteLinkMutation.mutate(link.id)
                          }
                          disabled={deleteLinkMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    );
                  }
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Create Link Dialog */}
      <Dialog open={isCreateLinkOpen} onOpenChange={setIsCreateLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Share Link</DialogTitle>
            <DialogDescription>
              Generate a shareable link for your presentation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Presentation</Label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select presentation" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map(
                    (p: { id: string; title: string }) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={linkSettings.platform}
                onValueChange={(v) =>
                  setLinkSettings({ ...linkSettings, platform: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Link</SelectItem>
                  <SelectItem value="twitter">Twitter / X</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expires In</Label>
              <Select
                value={linkSettings.expiresIn}
                onValueChange={(v) =>
                  setLinkSettings({ ...linkSettings, expiresIn: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="1d">1 Day</SelectItem>
                  <SelectItem value="7d">7 Days</SelectItem>
                  <SelectItem value="30d">30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Public Access</Label>
              <Switch
                checked={linkSettings.isPublic}
                onCheckedChange={(v) =>
                  setLinkSettings({ ...linkSettings, isPublic: v })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateLinkOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                createLinkMutation.mutate({
                  projectId: selectedProjectId,
                  ...linkSettings,
                })
              }
              disabled={
                !selectedProjectId || createLinkMutation.isPending
              }
            >
              {createLinkMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
