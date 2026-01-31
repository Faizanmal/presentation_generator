'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import {
  History,
  GitBranch,
  GitMerge,
  Flag,
  RotateCcw,
  Eye,
  ChevronRight,
  Clock,
  User,
  Plus,
  Minus,
  Edit3,
  ArrowLeftRight,
  Check,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Version {
  id: string;
  versionNumber: number;
  name: string;
  description?: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    avatar?: string;
  };
  isAutoSave: boolean;
  isMilestone: boolean;
  changes: {
    type: string;
    slideId?: string;
    description: string;
  }[];
}

interface VersionComparisonResult {
  versionA: Version;
  versionB: Version;
  differences: {
    slideId: string;
    status: 'added' | 'deleted' | 'modified' | 'unchanged';
  }[];
  summary: {
    slidesAdded: number;
    slidesDeleted: number;
    slidesModified: number;
    totalChanges: number;
  };
}

interface VersionHistoryPanelProps {
  projectId: string;
}

export function VersionHistoryPanel({ projectId }: VersionHistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersionA, setCompareVersionA] = useState<string | null>(null);
  const [compareVersionB, setCompareVersionB] = useState<string | null>(null);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [milestoneName, setMilestoneName] = useState('');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [branchName, setBranchName] = useState('');

  const queryClient = useQueryClient();

  const { data: versionsData, isLoading } = useQuery({
    queryKey: ['versions', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/versions`);
      return response.json();
    },
    enabled: isOpen,
  });

  const { data: comparisonData } = useQuery({
    queryKey: ['version-comparison', projectId, compareVersionA, compareVersionB],
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/versions/compare/${compareVersionA}/${compareVersionB}`
      );
      return response.json() as Promise<VersionComparisonResult>;
    },
    enabled: !!compareVersionA && !!compareVersionB,
  });

  const createVersionMutation = useMutation({
    mutationFn: async (data: { name?: string; description?: string; isMilestone?: boolean }) => {
      const response = await fetch(`/api/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions', projectId] });
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const response = await fetch(`/api/projects/${projectId}/versions/${versionId}/restore`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowRestoreDialog(false);
    },
  });

  const markMilestoneMutation = useMutation({
    mutationFn: async ({ versionId, name, description }: { versionId: string; name: string; description?: string }) => {
      const response = await fetch(`/api/projects/${projectId}/versions/${versionId}/milestone`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions', projectId] });
      setShowMilestoneDialog(false);
      setMilestoneName('');
      setMilestoneDescription('');
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: async ({ versionId, name }: { versionId: string; name: string }) => {
      const response = await fetch(`/api/projects/${projectId}/versions/${versionId}/branch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      return response.json();
    },
    onSuccess: () => {
      setShowBranchDialog(false);
      setBranchName('');
    },
  });

  const versions = versionsData?.versions || [];

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'slide_added':
        return <Plus className="h-3 w-3 text-green-500" />;
      case 'slide_deleted':
        return <Minus className="h-3 w-3 text-red-500" />;
      case 'slide_modified':
        return <Edit3 className="h-3 w-3 text-blue-500" />;
      default:
        return <Check className="h-3 w-3 text-gray-500" />;
    }
  };

  const handleVersionSelect = (version: Version) => {
    if (compareMode) {
      if (!compareVersionA) {
        setCompareVersionA(version.id);
      } else if (!compareVersionB) {
        setCompareVersionB(version.id);
      } else {
        setCompareVersionA(version.id);
        setCompareVersionB(null);
      }
    } else {
      setSelectedVersion(version);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <History className="mr-2 h-4 w-4" />
          Version History
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </SheetTitle>
          <SheetDescription>
            Track changes, restore previous versions, and manage milestones
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => createVersionMutation.mutate({ name: 'Manual save' })}
              disabled={createVersionMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              Save Version
            </Button>
            <Button
              size="sm"
              variant={compareMode ? 'secondary' : 'outline'}
              onClick={() => {
                setCompareMode(!compareMode);
                setCompareVersionA(null);
                setCompareVersionB(null);
              }}
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Compare
            </Button>
          </div>

          {/* Compare mode indicator */}
          {compareMode && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-700">
                {!compareVersionA
                  ? 'Select the first version to compare'
                  : !compareVersionB
                  ? 'Select the second version to compare'
                  : 'Comparing versions'}
              </p>
            </div>
          )}

          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all">All Versions</TabsTrigger>
              <TabsTrigger value="milestones">
                <Flag className="mr-2 h-4 w-4" />
                Milestones
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : versions.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No versions yet. Save a version to start tracking changes.
                  </div>
                ) : (
                  <div className="space-y-2 pr-4">
                    {versions.map((version: Version) => (
                      <div
                        key={version.id}
                        className={cn(
                          'cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50',
                          selectedVersion?.id === version.id && 'border-primary bg-primary/5',
                          compareVersionA === version.id && 'border-blue-500 bg-blue-50',
                          compareVersionB === version.id && 'border-green-500 bg-green-50'
                        )}
                        onClick={() => handleVersionSelect(version)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {version.isMilestone && (
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            )}
                            <span className="font-medium">{version.name}</span>
                            {version.isAutoSave && (
                              <Badge variant="outline" className="text-xs">
                                Auto
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            v{version.versionNumber}
                          </span>
                        </div>

                        {version.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {version.description}
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={version.createdBy.avatar} />
                              <AvatarFallback>
                                {version.createdBy.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            {version.createdBy.name}
                          </span>
                        </div>

                        {version.changes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {version.changes.slice(0, 3).map((change, i) => (
                              <span
                                key={i}
                                className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
                              >
                                {getChangeIcon(change.type)}
                                {change.description}
                              </span>
                            ))}
                            {version.changes.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{version.changes.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="milestones">
              <ScrollArea className="h-[400px]">
                {versions.filter((v: Version) => v.isMilestone).length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No milestones yet. Mark important versions as milestones.
                  </div>
                ) : (
                  <div className="space-y-2 pr-4">
                    {versions
                      .filter((v: Version) => v.isMilestone)
                      .map((version: Version) => (
                        <div
                          key={version.id}
                          className="rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">{version.name}</span>
                          </div>
                          {version.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {version.description}
                            </p>
                          )}
                          <div className="mt-2 text-xs text-muted-foreground">
                            {format(new Date(version.createdAt), 'PPp')}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Comparison result */}
          {comparisonData && (
            <div className="space-y-3 rounded-lg border p-4">
              <h4 className="font-medium">Comparison Result</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded bg-green-100 p-2">
                  <div className="text-2xl font-bold text-green-700">
                    {comparisonData.summary.slidesAdded}
                  </div>
                  <div className="text-xs text-green-600">Added</div>
                </div>
                <div className="rounded bg-red-100 p-2">
                  <div className="text-2xl font-bold text-red-700">
                    {comparisonData.summary.slidesDeleted}
                  </div>
                  <div className="text-xs text-red-600">Deleted</div>
                </div>
                <div className="rounded bg-blue-100 p-2">
                  <div className="text-2xl font-bold text-blue-700">
                    {comparisonData.summary.slidesModified}
                  </div>
                  <div className="text-xs text-blue-600">Modified</div>
                </div>
              </div>
            </div>
          )}

          {/* Selected version actions */}
          {selectedVersion && !compareMode && (
            <div className="space-y-3 rounded-lg border p-4">
              <h4 className="font-medium">Version Actions</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRestoreDialog(true)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMilestoneDialog(true)}
                >
                  <Flag className="mr-2 h-4 w-4" />
                  Mark as Milestone
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowBranchDialog(true)}
                >
                  <GitBranch className="mr-2 h-4 w-4" />
                  Create Branch
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Restore Dialog */}
        <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore Version</DialogTitle>
              <DialogDescription>
                Are you sure you want to restore to &quot;{selectedVersion?.name}&quot;? A backup of your current version will be created automatically.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedVersion && restoreVersionMutation.mutate(selectedVersion.id)}
                disabled={restoreVersionMutation.isPending}
              >
                Restore
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Milestone Dialog */}
        <Dialog open={showMilestoneDialog} onOpenChange={setShowMilestoneDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Milestone</DialogTitle>
              <DialogDescription>
                Give this version a meaningful name to easily find it later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="milestone-name">Milestone Name</Label>
                <Input
                  id="milestone-name"
                  value={milestoneName}
                  onChange={(e) => setMilestoneName(e.target.value)}
                  placeholder="e.g., Final Draft, Client Review"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="milestone-desc">Description (optional)</Label>
                <Textarea
                  id="milestone-desc"
                  value={milestoneDescription}
                  onChange={(e) => setMilestoneDescription(e.target.value)}
                  placeholder="Add notes about this milestone..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMilestoneDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  selectedVersion &&
                  markMilestoneMutation.mutate({
                    versionId: selectedVersion.id,
                    name: milestoneName,
                    description: milestoneDescription,
                  })
                }
                disabled={!milestoneName || markMilestoneMutation.isPending}
              >
                Mark as Milestone
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Branch Dialog */}
        <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Branch</DialogTitle>
              <DialogDescription>
                Create a new presentation branch from this version. The branch will be a separate copy you can edit independently.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g., Alternative Design, Client A Version"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBranchDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  selectedVersion &&
                  createBranchMutation.mutate({
                    versionId: selectedVersion.id,
                    name: branchName,
                  })
                }
                disabled={!branchName || createBranchMutation.isPending}
              >
                Create Branch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
