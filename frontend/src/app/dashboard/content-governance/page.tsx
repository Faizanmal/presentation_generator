"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Shield,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Lock,
  Unlock,
  FileText,
  Loader2,
  Eye,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function ContentGovernancePage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const orgId = user?.organizationId ?? '';
  const [activeTab, setActiveTab] = useState("workflows");
  const [isCreateWorkflowOpen, setIsCreateWorkflowOpen] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: "",
    description: "",
    approvalStages: 1,
  });

  // Fetch approval workflows
  const { data: workflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ["governance-workflows"],
    queryFn: () => api.governance.getWorkflows(orgId),
  });

  // Fetch pending requests
  const { data: pendingRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ["governance-requests", "pending"],
    queryFn: () => api.governance.getPendingRequests(orgId),
  });

  // Fetch content locks
  const { data: contentLocks } = useQuery({
    queryKey: ["governance-locks"],
    queryFn: () => api.governance.getContentLocks(orgId),
  });

  // Fetch policies
  const { data: policies } = useQuery({
    queryKey: ["governance-policies"],
    queryFn: () => api.governance.getPolicies(orgId),
  });

  // Create workflow mutation
  const createWorkflowMutation = useMutation({
    mutationFn: (data: typeof newWorkflow) =>
      api.governance.createWorkflow(orgId, {
        name: data.name,
        description: data.description,
        stages: Array.from({ length: data.approvalStages }, (_, i) => `Stage ${i + 1}`),
        requiredApprovers: {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-workflows"] });
      setIsCreateWorkflowOpen(false);
      setNewWorkflow({ name: "", description: "", approvalStages: 1 });
      toast.success("Approval workflow created!");
    },
    onError: () => toast.error("Failed to create workflow"),
  });

  // Approve/reject request mutation
  const handleRequestMutation = useMutation({
    mutationFn: ({
      requestId,
      action,
      comment,
    }: {
      requestId: string;
      action: "approve" | "reject";
      comment?: string;
    }) => api.governance.handleRequest(requestId, action, comment),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["governance-requests"] });
      toast.success(
        variables.action === "approve"
          ? "Request approved!"
          : "Request rejected."
      );
    },
    onError: () => toast.error("Failed to process request"),
  });

  // Unlock content mutation
  const unlockContentMutation = useMutation({
    mutationFn: (lockId: string) => api.governance.unlockContent(lockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-locks"] });
      toast.success("Content unlocked!");
    },
    onError: () => toast.error("Failed to unlock content"),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-yellow-100 text-yellow-700">
            <Clock className="h-3 w-3 mr-1" /> Pending
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-red-100 text-red-700">
            <XCircle className="h-3 w-3 mr-1" /> Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
                <div className="h-8 w-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  Content Governance
                </span>
              </div>
            </div>
            <Button onClick={() => setIsCreateWorkflowOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Workflow
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Active Workflows
                  </p>
                  <p className="text-2xl font-bold">
                    {workflows?.length ?? 0}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Pending Approvals
                  </p>
                  <p className="text-2xl font-bold">
                    {pendingRequests?.length ?? 0}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Content Locks</p>
                  <p className="text-2xl font-bold">
                    {contentLocks?.length ?? 0}
                  </p>
                </div>
                <Lock className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Policies</p>
                  <p className="text-2xl font-bold">
                    {policies?.length ?? 0}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="workflows">
              <Shield className="h-4 w-4 mr-2" /> Workflows
            </TabsTrigger>
            <TabsTrigger value="requests">
              <Clock className="h-4 w-4 mr-2" /> Pending Requests
            </TabsTrigger>
            <TabsTrigger value="locks">
              <Lock className="h-4 w-4 mr-2" /> Content Locks
            </TabsTrigger>
            <TabsTrigger value="policies">
              <FileText className="h-4 w-4 mr-2" /> Policies
            </TabsTrigger>
          </TabsList>

          {/* Workflows Tab */}
          <TabsContent value="workflows" className="space-y-4">
            {workflowsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !workflows?.length ? (
              <Card className="p-8 text-center">
                <CardContent className="flex flex-col items-center gap-4 pt-6">
                  <Shield className="h-12 w-12 text-slate-300" />
                  <div>
                    <h3 className="text-lg font-semibold">No Workflows</h3>
                    <p className="text-muted-foreground">
                      Create an approval workflow to manage content governance.
                    </p>
                  </div>
                  <Button onClick={() => setIsCreateWorkflowOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Create Workflow
                  </Button>
                </CardContent>
              </Card>
            ) : (
              workflows.map(
                (wf: {
                  id: string;
                  name: string;
                  stages?: string[];
                  description?: string;
                  status?: string;
                  approvalStages?: number;
                  createdAt?: string;
                }) => (
                  <Card key={wf.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{wf.name}</CardTitle>
                          <CardDescription>
                            {wf.description || "No description"}
                          </CardDescription>
                        </div>
                        {getStatusBadge(wf.status || 'ACTIVE')}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          {wf.stages?.length ?? wf.approvalStages ?? 1} approval stage
                          {(wf.stages?.length ?? wf.approvalStages ?? 1) > 1 ? "s" : ""}
                        </span>
                        {wf.createdAt && (
                        <span>
                          Created{" "}
                          {new Date(wf.createdAt).toLocaleDateString()}
                        </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              )
            )}
          </TabsContent>

          {/* Pending Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            {requestsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !pendingRequests?.length ? (
              <Card className="p-8 text-center">
                <CardContent className="flex flex-col items-center gap-4 pt-6">
                  <CheckCircle2 className="h-12 w-12 text-green-400" />
                  <div>
                    <h3 className="text-lg font-semibold">All Clear</h3>
                    <p className="text-muted-foreground">
                      No pending approval requests.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map(
                (req: {
                  id: string;
                  title?: string;
                  type?: string;
                  requestedBy?: { name?: string };
                  createdAt: string;
                  status: string;
                }) => (
                  <Card key={req.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {req.title || "Approval Request"}
                          </CardTitle>
                          <CardDescription>
                            {req.type || "Content"} • Requested by{" "}
                            {req.requestedBy?.name || "Unknown"} •{" "}
                            {new Date(req.createdAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleRequestMutation.mutate({
                              requestId: req.id,
                              action: "approve",
                            })
                          }
                          disabled={handleRequestMutation.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            handleRequestMutation.mutate({
                              requestId: req.id,
                              action: "reject",
                            })
                          }
                          disabled={handleRequestMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" /> Review
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              )
            )}
          </TabsContent>

          {/* Content Locks Tab */}
          <TabsContent value="locks" className="space-y-4">
            {!contentLocks?.length ? (
              <Card className="p-8 text-center">
                <CardContent className="flex flex-col items-center gap-4 pt-6">
                  <Unlock className="h-12 w-12 text-slate-300" />
                  <div>
                    <h3 className="text-lg font-semibold">No Content Locks</h3>
                    <p className="text-muted-foreground">
                      No content is currently locked.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              contentLocks.map(
                (lock: {
                  id: string;
                  projectId?: string;
                  contentType?: string;
                  contentId?: string;
                  lockedBy?: string | { name?: string };
                  createdAt?: string;
                  lockedAt?: string;
                  reason?: string;
                }) => (
                  <Card key={lock.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Lock className="h-4 w-4 text-red-500" />
                            {lock.contentType || "Content"} — {lock.contentId || lock.projectId}
                          </CardTitle>
                          <CardDescription>
                            Locked by {typeof lock.lockedBy === 'object' ? lock.lockedBy?.name || "Unknown" : lock.lockedBy || "Unknown"} on{" "}
                            {new Date(lock.lockedAt || lock.createdAt || '').toLocaleDateString()}
                            {lock.reason && ` — ${lock.reason}`}
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            unlockContentMutation.mutate(lock.id)
                          }
                          disabled={unlockContentMutation.isPending}
                        >
                          <Unlock className="h-4 w-4 mr-1" /> Unlock
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                )
              )
            )}
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-4">
            {!policies?.length ? (
              <Card className="p-8 text-center">
                <CardContent className="flex flex-col items-center gap-4 pt-6">
                  <FileText className="h-12 w-12 text-slate-300" />
                  <div>
                    <h3 className="text-lg font-semibold">No Policies</h3>
                    <p className="text-muted-foreground">
                      No governance policies have been configured.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              policies.map(
                (policy: {
                  id: string;
                  name: string;
                  description?: string;
                  isActive?: boolean;
                  type?: string;
                  rules?: unknown[];
                  enforcementLevel?: string;
                }) => {
                  const isActive = policy.isActive ?? (policy.enforcementLevel ? policy.enforcementLevel !== 'DISABLED' && policy.enforcementLevel !== 'disabled' : true);
                  const policyType = policy.type || policy.enforcementLevel;
                  return (
                    <Card key={policy.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">
                              {policy.name}
                            </CardTitle>
                            <CardDescription>
                              {policy.description || (policy.rules ? `${(policy.rules as unknown[]).length} rule(s)` : "No description")}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={isActive ? "default" : "secondary"}>
                              {isActive ? "Active" : "Inactive"}
                            </Badge>
                            {policyType && (
                              <Badge variant="outline">{policyType}</Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                }
              )
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Create Workflow Dialog */}
      <Dialog
        open={isCreateWorkflowOpen}
        onOpenChange={setIsCreateWorkflowOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Approval Workflow</DialogTitle>
            <DialogDescription>
              Define a content approval workflow for your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wf-name">Workflow Name</Label>
              <Input
                id="wf-name"
                value={newWorkflow.name}
                onChange={(e) =>
                  setNewWorkflow({ ...newWorkflow, name: e.target.value })
                }
                placeholder="e.g., Marketing Review"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-desc">Description</Label>
              <Textarea
                id="wf-desc"
                value={newWorkflow.description}
                onChange={(e) =>
                  setNewWorkflow({
                    ...newWorkflow,
                    description: e.target.value,
                  })
                }
                placeholder="Describe the workflow..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-stages">Approval Stages</Label>
              <Select
                value={String(newWorkflow.approvalStages)}
                onValueChange={(v) =>
                  setNewWorkflow({
                    ...newWorkflow,
                    approvalStages: parseInt(v),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Stage</SelectItem>
                  <SelectItem value="2">2 Stages</SelectItem>
                  <SelectItem value="3">3 Stages</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateWorkflowOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createWorkflowMutation.mutate(newWorkflow)}
              disabled={
                !newWorkflow.name || createWorkflowMutation.isPending
              }
            >
              {createWorkflowMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
