'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Webhook,
  Plus,
  Trash2,
  Edit,
  Copy,
  RefreshCw,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { WebhookConfig } from '@/types';

const WEBHOOK_EVENTS = [
  { id: 'project.created', label: 'Project Created', category: 'Projects' },
  { id: 'project.updated', label: 'Project Updated', category: 'Projects' },
  { id: 'project.deleted', label: 'Project Deleted', category: 'Projects' },
  { id: 'project.shared', label: 'Project Shared', category: 'Projects' },
  { id: 'project.exported', label: 'Project Exported', category: 'Projects' },
  { id: 'slide.created', label: 'Slide Created', category: 'Slides' },
  { id: 'slide.updated', label: 'Slide Updated', category: 'Slides' },
  { id: 'slide.deleted', label: 'Slide Deleted', category: 'Slides' },
  { id: 'collaborator.added', label: 'Collaborator Added', category: 'Collaboration' },
  { id: 'collaborator.removed', label: 'Collaborator Removed', category: 'Collaboration' },
  { id: 'comment.created', label: 'Comment Created', category: 'Collaboration' },
  { id: 'comment.resolved', label: 'Comment Resolved', category: 'Collaboration' },
  { id: 'presentation.started', label: 'Presentation Started', category: 'Live' },
  { id: 'presentation.ended', label: 'Presentation Ended', category: 'Live' },
  { id: 'ai.generation.completed', label: 'AI Generation Completed', category: 'AI' },
];

export function WebhooksSettings() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  // Form state
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [customSecret, setCustomSecret] = useState('');

  // Fetch webhooks
  const { data: webhooks, isLoading } = useQuery<WebhookConfig[]>({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const response = await api.getWebhooks();
      return response as WebhookConfig[];
    },
  });

  // Create webhook mutation
  const createMutation = useMutation({
    mutationFn: async (data: { url: string; events: string[]; secret?: string }) => {
      const response = await api.createWebhook(data.url, data.events, data.secret);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setShowCreateDialog(false);
      resetForm();
      toast.success('Webhook created successfully');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to create webhook');
    },
  });

  // Update webhook mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { url?: string; events?: string[]; active?: boolean } }) => {
      await api.updateWebhook(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setEditingWebhook(null);
      resetForm();
      toast.success('Webhook updated successfully');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update webhook');
    },
  });

  // Delete webhook mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook deleted');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to delete webhook');
    },
  });

  // Test webhook mutation
  const testMutation = useMutation({
    mutationFn: (id: string) => api.testWebhook(id),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Webhook test successful');
      } else {
        toast.error(`Webhook test failed: ${data.error}`);
      }
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to test webhook');
    },
  });

  const resetForm = () => {
    setUrl('');
    setSelectedEvents([]);
    setCustomSecret('');
  };

  const handleCreate = () => {
    if (!url.trim()) {
      toast.error('Please enter a webhook URL');
      return;
    }
    if (selectedEvents.length === 0) {
      toast.error('Please select at least one event');
      return;
    }

    createMutation.mutate({
      url: url.trim(),
      events: selectedEvents,
      secret: customSecret.trim() || undefined,
    });
  };

  const handleUpdate = () => {
    if (!editingWebhook) {return;}

    updateMutation.mutate({
      id: editingWebhook.id,
      updates: {
        url: url.trim(),
        events: selectedEvents,
      },
    });
  };

  const handleToggleActive = (webhook: WebhookConfig) => {
    updateMutation.mutate({
      id: webhook.id,
      updates: { active: !webhook.active },
    });
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast.success('Secret copied to clipboard');
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((e) => e !== eventId)
        : [...prev, eventId]
    );
  };

  const selectAllEvents = () => {
    setSelectedEvents(WEBHOOK_EVENTS.map((e) => e.id));
  };

  const clearAllEvents = () => {
    setSelectedEvents([]);
  };

  const openEditDialog = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setUrl(webhook.url);
    setSelectedEvents(webhook.events);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Group events by category
  const eventsByCategory = WEBHOOK_EVENTS.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = [];
    }
    acc[event.category].push(event);
    return acc;
  }, {} as Record<string, typeof WEBHOOK_EVENTS>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Webhooks</h2>
          <p className="text-sm text-slate-500">
            Receive real-time notifications about events in your presentations
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                Configure a new webhook endpoint to receive event notifications.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="url">Endpoint URL</Label>
                <Input
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="secret">Secret (optional)</Label>
                <Input
                  id="secret"
                  value={customSecret}
                  onChange={(e) => setCustomSecret(e.target.value)}
                  placeholder="Auto-generated if left empty"
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Used to verify webhook signatures. Leave empty to auto-generate.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Events</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllEvents}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllEvents}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[250px] border rounded-lg p-3">
                  {Object.entries(eventsByCategory).map(([category, events]) => (
                    <div key={category} className="mb-4">
                      <h4 className="font-medium text-sm mb-2">{category}</h4>
                      <div className="space-y-2 ml-2">
                        {events.map((event) => (
                          <label
                            key={event.id}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedEvents.includes(event.id)}
                              onCheckedChange={() => toggleEventSelection(event.id)}
                            />
                            <span className="text-sm">{event.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Create Webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Webhooks list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : webhooks?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Webhook className="h-12 w-12 text-slate-400 mb-4" />
            <h3 className="font-medium text-lg mb-2">No webhooks configured</h3>
            <p className="text-sm text-slate-500 text-center max-w-md">
              Webhooks allow you to receive real-time notifications when events
              happen in your presentations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks?.map((webhook: WebhookConfig) => (
            <Card key={webhook.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        webhook.active ? 'bg-green-500' : 'bg-slate-400'
                      )}
                    />
                    <div>
                      <CardTitle className="text-base font-mono">
                        {webhook.url}
                      </CardTitle>
                      <CardDescription>
                        Created {formatDate(webhook.createdAt.toISOString())}
                        {webhook.lastTriggeredAt && (
                          <> • Last triggered {formatDate(webhook.lastTriggeredAt.toISOString())}</>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.active}
                      onCheckedChange={() => handleToggleActive(webhook)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Events */}
                <div className="flex flex-wrap gap-1">
                  {webhook.events.slice(0, 5).map((event: string) => (
                    <Badge key={event} variant="secondary" className="text-xs">
                      {WEBHOOK_EVENTS.find((e) => e.id === event)?.label || event}
                    </Badge>
                  ))}
                  {webhook.events.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{webhook.events.length - 5} more
                    </Badge>
                  )}
                </div>

                {/* Secret */}
                <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-sm text-slate-500">Secret:</span>
                  <code className="flex-1 text-sm font-mono">
                    {showSecret[webhook.id]
                      ? webhook.secret
                      : '••••••••••••••••••••'}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() =>
                      setShowSecret((prev) => ({
                        ...prev,
                        [webhook.id]: !prev[webhook.id],
                      }))
                    }
                  >
                    {showSecret[webhook.id] ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copySecret(webhook.secret)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>

                {/* Status */}
                {webhook.failureCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{webhook.failureCount} recent failures</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testMutation.mutate(webhook.id)}
                    disabled={testMutation.isPending}
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    Test
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(webhook)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => deleteMutation.mutate(webhook.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingWebhook} onOpenChange={(open) => !open && setEditingWebhook(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-url">Endpoint URL</Label>
              <Input
                id="edit-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Events</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAllEvents}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAllEvents}>
                    Clear
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[250px] border rounded-lg p-3">
                {Object.entries(eventsByCategory).map(([category, events]) => (
                  <div key={category} className="mb-4">
                    <h4 className="font-medium text-sm mb-2">{category}</h4>
                    <div className="space-y-2 ml-2">
                      {events.map((event) => (
                        <label
                          key={event.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedEvents.includes(event.id)}
                            onCheckedChange={() => toggleEventSelection(event.id)}
                          />
                          <span className="text-sm">{event.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWebhook(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
