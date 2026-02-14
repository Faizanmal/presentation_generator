'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';
import {
  Webhook,
  Plus,
  MoreHorizontal,
  Trash2,
  Copy,
  RefreshCw,
  Check,
  X,
  CheckCircle,
  Clock,
  ArrowRight,
  Code,
  Eye,
  EyeOff,
  Send,
  Zap,
} from 'lucide-react';

interface WebhookEvent {
  id: string;
  name: string;
  description: string;
  category: 'presentation' | 'slide' | 'collaboration' | 'export' | 'system';
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  lastTriggered?: string;
  successCount: number;
  failureCount: number;
  headers: Record<string, string>;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
  };
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  status: 'success' | 'failed' | 'pending' | 'retrying';
  statusCode?: number;
  requestBody: string;
  responseBody?: string;
  duration: number;
  timestamp: string;
  retryCount: number;
}

const WEBHOOK_EVENTS: WebhookEvent[] = [
  { id: 'presentation.created', name: 'Presentation Created', description: 'When a new presentation is created', category: 'presentation' },
  { id: 'presentation.updated', name: 'Presentation Updated', description: 'When a presentation is modified', category: 'presentation' },
  { id: 'presentation.deleted', name: 'Presentation Deleted', description: 'When a presentation is deleted', category: 'presentation' },
  { id: 'presentation.published', name: 'Presentation Published', description: 'When a presentation is published', category: 'presentation' },
  { id: 'slide.created', name: 'Slide Created', description: 'When a new slide is added', category: 'slide' },
  { id: 'slide.updated', name: 'Slide Updated', description: 'When a slide is modified', category: 'slide' },
  { id: 'slide.deleted', name: 'Slide Deleted', description: 'When a slide is removed', category: 'slide' },
  { id: 'collaboration.member_added', name: 'Member Added', description: 'When a collaborator is added', category: 'collaboration' },
  { id: 'collaboration.member_removed', name: 'Member Removed', description: 'When a collaborator is removed', category: 'collaboration' },
  { id: 'collaboration.comment_added', name: 'Comment Added', description: 'When a comment is added', category: 'collaboration' },
  { id: 'export.started', name: 'Export Started', description: 'When an export is initiated', category: 'export' },
  { id: 'export.completed', name: 'Export Completed', description: 'When an export finishes', category: 'export' },
  { id: 'export.failed', name: 'Export Failed', description: 'When an export fails', category: 'export' },
];

const MOCK_WEBHOOKS: WebhookConfig[] = [
  {
    id: '1',
    name: 'Slack Notifications',
    url: 'https://example.com/webhook-placeholder',
    secret: 'your-webhook-secret-here',
    events: ['presentation.published', 'collaboration.comment_added'],
    enabled: true,
    createdAt: '2024-05-15',
    lastTriggered: '2 hours ago',
    successCount: 156,
    failureCount: 3,
    headers: { 'Content-Type': 'application/json' },
    retryConfig: { maxRetries: 3, retryDelay: 5000 },
  },
  {
    id: '2',
    name: 'Analytics Backend',
    url: 'https://api.analytics.example.com/webhook',
    events: ['presentation.created', 'presentation.updated', 'slide.created'],
    enabled: true,
    createdAt: '2024-06-01',
    lastTriggered: '30 minutes ago',
    successCount: 423,
    failureCount: 12,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'ak_123456' },
    retryConfig: { maxRetries: 5, retryDelay: 10000 },
  },
  {
    id: '3',
    name: 'CRM Integration',
    url: 'https://crm.example.com/api/webhooks/presentations',
    secret: 'whsec_def456uvw',
    events: ['presentation.published'],
    enabled: false,
    createdAt: '2024-04-20',
    successCount: 89,
    failureCount: 45,
    headers: { 'Content-Type': 'application/json' },
    retryConfig: { maxRetries: 2, retryDelay: 3000 },
  },
];

const MOCK_DELIVERIES: WebhookDelivery[] = [
  {
    id: '1',
    webhookId: '1',
    event: 'presentation.published',
    status: 'success',
    statusCode: 200,
    requestBody: JSON.stringify({ event: 'presentation.published', presentation_id: 'pres_123' }, null, 2),
    responseBody: '{"ok": true}',
    duration: 234,
    timestamp: '2 hours ago',
    retryCount: 0,
  },
  {
    id: '2',
    webhookId: '2',
    event: 'slide.created',
    status: 'success',
    statusCode: 201,
    requestBody: JSON.stringify({ event: 'slide.created', slide_id: 'slide_456' }, null, 2),
    responseBody: '{"received": true}',
    duration: 156,
    timestamp: '30 minutes ago',
    retryCount: 0,
  },
  {
    id: '3',
    webhookId: '3',
    event: 'presentation.published',
    status: 'failed',
    statusCode: 500,
    requestBody: JSON.stringify({ event: 'presentation.published', presentation_id: 'pres_789' }, null, 2),
    responseBody: '{"error": "Internal server error"}',
    duration: 5023,
    timestamp: '1 day ago',
    retryCount: 2,
  },
  {
    id: '4',
    webhookId: '1',
    event: 'collaboration.comment_added',
    status: 'retrying',
    requestBody: JSON.stringify({ event: 'collaboration.comment_added', comment_id: 'com_101' }, null, 2),
    duration: 0,
    timestamp: '5 minutes ago',
    retryCount: 1,
  },
];

export function WebhookManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(MOCK_WEBHOOKS);
  const [deliveries] = useState<WebhookDelivery[]>(MOCK_DELIVERIES);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
  }>({ status: 'idle' });

  // Create webhook form state
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
    headers: {} as Record<string, string>,
    maxRetries: 3,
    retryDelay: 5000,
  });

  const getStatusBadge = (status: WebhookDelivery['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Success</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 gap-1"><X className="h-3 w-3" /> Failed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700 gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'retrying':
        return <Badge className="bg-orange-100 text-orange-700 gap-1"><RefreshCw className="h-3 w-3" /> Retrying</Badge>;
    }
  };

  const toggleWebhook = (id: string) => {
    setWebhooks((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const deleteWebhook = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
    if (selectedWebhook?.id === id) {
      setSelectedWebhook(null);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleEventSelection = (eventId: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  const testWebhook = async (_webhook?: WebhookConfig) => {
    setTestResult({ status: 'loading' });

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Random success/failure for demo
    const success = Math.random() > 0.3;
    setTestResult({
      status: success ? 'success' : 'error',
      message: success
        ? 'Webhook test successful! Response received in 234ms'
        : 'Webhook test failed: Connection timeout',
    });

    setTimeout(() => setTestResult({ status: 'idle' }), 5000);
  };

  const createWebhook = () => {
    const webhook: WebhookConfig = {
      id: `webhook_${Date.now()}`,
      name: newWebhook.name,
      url: newWebhook.url,
      secret: newWebhook.secret || undefined,
      events: newWebhook.events,
      enabled: true,
      createdAt: new Date().toISOString().split('T')[0],
      successCount: 0,
      failureCount: 0,
      headers: { 'Content-Type': 'application/json', ...newWebhook.headers },
      retryConfig: {
        maxRetries: newWebhook.maxRetries,
        retryDelay: newWebhook.retryDelay,
      },
    };

    setWebhooks((prev) => [...prev, webhook]);
    setNewWebhook({
      name: '',
      url: '',
      events: [],
      secret: '',
      headers: {},
      maxRetries: 3,
      retryDelay: 5000,
    });
    setShowCreateDialog(false);
  };

  const groupedEvents = WEBHOOK_EVENTS.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = [];
    }
    acc[event.category].push(event);
    return acc;
  }, {} as Record<string, WebhookEvent[]>);

  const getWebhookDeliveries = (webhookId: string) =>
    deliveries.filter((d) => d.webhookId === webhookId);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Webhook className="h-4 w-4" />
          Webhooks
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Management
          </DialogTitle>
          <DialogDescription>
            Configure webhooks to integrate with external services
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="webhooks" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="deliveries">Recent Deliveries</TabsTrigger>
              <TabsTrigger value="events">Events Reference</TabsTrigger>
            </TabsList>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </div>

          <TabsContent value="webhooks" className="mt-0">
            <div className="flex gap-4">
              {/* Webhook List */}
              <div className="w-1/2">
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-3">
                    {webhooks.map((webhook) => (
                      <Card
                        key={webhook.id}
                        className={`cursor-pointer transition-all ${selectedWebhook?.id === webhook.id
                          ? 'ring-2 ring-primary'
                          : 'hover:shadow-md'
                          }`}
                        onClick={() => setSelectedWebhook(webhook)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{webhook.name}</h3>
                                {webhook.enabled ? (
                                  <Badge className="bg-green-100 text-green-700">Active</Badge>
                                ) : (
                                  <Badge variant="secondary">Disabled</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 truncate max-w-[250px]">
                                {webhook.url}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  {webhook.events.length} events
                                </span>
                                {webhook.lastTriggered && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {webhook.lastTriggered}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={webhook.enabled}
                                onCheckedChange={() => toggleWebhook(webhook.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => testWebhook(webhook)}>
                                    <Send className="h-4 w-4 mr-2" />
                                    Test Webhook
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => deleteWebhook(webhook.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* Stats bar */}
                          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                            <div className="flex items-center gap-1 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-green-600">{webhook.successCount}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <X className="h-4 w-4 text-red-500" />
                              <span className="text-red-600">{webhook.failureCount}</span>
                            </div>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500"
                                style={{
                                  width: `${(webhook.successCount /
                                    (webhook.successCount + webhook.failureCount)) *
                                    100
                                    }%`,
                                }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Webhook Details */}
              <div className="w-1/2">
                {selectedWebhook ? (
                  <Card className="h-[500px]">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{selectedWebhook.name}</CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testWebhook(selectedWebhook)}
                          disabled={testResult.status === 'loading'}
                        >
                          {testResult.status === 'loading' ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Test
                        </Button>
                      </div>
                      {testResult.status !== 'idle' && testResult.status !== 'loading' && (
                        <div
                          className={`p-2 rounded text-sm ${testResult.status === 'success'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                            }`}
                        >
                          {testResult.message}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[380px] pr-4">
                        <div className="space-y-4">
                          {/* URL */}
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Endpoint URL</Label>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 p-2 bg-muted rounded text-sm break-all">
                                {selectedWebhook.url}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                onClick={() => copyToClipboard(selectedWebhook.url, 'url')}
                              >
                                {copied === 'url' ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Secret */}
                          {selectedWebhook.secret && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Signing Secret</Label>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                                  {showSecrets[selectedWebhook.id]
                                    ? selectedWebhook.secret
                                    : '••••••••••••••••'}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0"
                                  onClick={() =>
                                    setShowSecrets((prev) => ({
                                      ...prev,
                                      [selectedWebhook.id]: !prev[selectedWebhook.id],
                                    }))
                                  }
                                >
                                  {showSecrets[selectedWebhook.id] ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0"
                                  onClick={() =>
                                    copyToClipboard(selectedWebhook.secret || '', 'secret')
                                  }
                                >
                                  {copied === 'secret' ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Events */}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Subscribed Events</Label>
                            <div className="flex flex-wrap gap-1">
                              {selectedWebhook.events.map((event) => (
                                <Badge key={event} variant="secondary" className="text-xs">
                                  {event}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {/* Headers */}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Headers</Label>
                            <div className="bg-muted rounded p-2 space-y-1">
                              {Object.entries(selectedWebhook.headers).map(([key, value]) => (
                                <div key={key} className="flex items-center text-xs font-mono">
                                  <span className="text-blue-600">{key}:</span>
                                  <span className="ml-2 text-muted-foreground">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Retry Config */}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Retry Configuration</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2 bg-muted rounded text-sm">
                                <span className="text-muted-foreground">Max Retries:</span>{' '}
                                {selectedWebhook.retryConfig.maxRetries}
                              </div>
                              <div className="p-2 bg-muted rounded text-sm">
                                <span className="text-muted-foreground">Delay:</span>{' '}
                                {selectedWebhook.retryConfig.retryDelay}ms
                              </div>
                            </div>
                          </div>

                          {/* Recent Deliveries */}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Recent Deliveries</Label>
                            <div className="space-y-2">
                              {getWebhookDeliveries(selectedWebhook.id)
                                .slice(0, 3)
                                .map((delivery) => (
                                  <div
                                    key={delivery.id}
                                    className="p-2 bg-muted rounded flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-2">
                                      {getStatusBadge(delivery.status)}
                                      <span className="text-sm">{delivery.event}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {delivery.timestamp}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="h-[500px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Webhook className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Select a webhook to view details</p>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deliveries" className="mt-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {deliveries.map((delivery) => {
                  const webhook = webhooks.find((w) => w.id === delivery.webhookId);
                  return (
                    <Card key={delivery.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(delivery.status)}
                              <span className="font-medium">{delivery.event}</span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">{webhook?.name}</span>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span>{delivery.timestamp}</span>
                              {delivery.statusCode && (
                                <span>
                                  Status: <code>{delivery.statusCode}</code>
                                </span>
                              )}
                              {delivery.duration > 0 && <span>{delivery.duration}ms</span>}
                              {delivery.retryCount > 0 && (
                                <span>Retries: {delivery.retryCount}</span>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Code className="h-4 w-4 mr-2" />
                            View Payload
                          </Button>
                        </div>

                        {/* Expandable payload section */}
                        <details className="mt-3">
                          <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                            View request/response
                          </summary>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Request</Label>
                              <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                                {delivery.requestBody}
                              </pre>
                            </div>
                            <div>
                              <Label className="text-xs">Response</Label>
                              <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                                {delivery.responseBody || 'No response'}
                              </pre>
                            </div>
                          </div>
                        </details>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="events" className="mt-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-6">
                {Object.entries(groupedEvents).map(([category, events]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold capitalize mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      {category}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {events.map((event) => (
                        <Card key={event.id}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-sm">{event.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {event.description}
                                </p>
                              </div>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {event.id}
                              </code>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Create Webhook Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                Configure a new webhook to receive event notifications
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label>Webhook Name</Label>
                <Input
                  placeholder="e.g., Slack Integration"
                  value={newWebhook.name}
                  onChange={(e) =>
                    setNewWebhook((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              {/* URL */}
              <div className="space-y-2">
                <Label>Payload URL</Label>
                <Input
                  placeholder="https://example.com/webhook"
                  value={newWebhook.url}
                  onChange={(e) =>
                    setNewWebhook((prev) => ({ ...prev, url: e.target.value }))
                  }
                />
              </div>

              {/* Secret */}
              <div className="space-y-2">
                <Label>Secret (optional)</Label>
                <Input
                  placeholder="Signing secret for verification"
                  value={newWebhook.secret}
                  onChange={(e) =>
                    setNewWebhook((prev) => ({ ...prev, secret: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Used to verify webhook signatures
                </p>
              </div>

              {/* Events */}
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="border rounded-lg p-4 space-y-4 max-h-48 overflow-y-auto">
                  {Object.entries(groupedEvents).map(([category, events]) => (
                    <div key={category}>
                      <p className="text-sm font-medium capitalize mb-2">{category}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {events.map((event) => (
                          <label
                            key={event.id}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={newWebhook.events.includes(event.id)}
                              onChange={() => toggleEventSelection(event.id)}
                              className="rounded"
                            />
                            {event.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Retry Config */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Retries</Label>
                  <Select
                    value={String(newWebhook.maxRetries)}
                    onValueChange={(value) =>
                      setNewWebhook((prev) => ({ ...prev, maxRetries: parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No retries</SelectItem>
                      <SelectItem value="1">1 retry</SelectItem>
                      <SelectItem value="3">3 retries</SelectItem>
                      <SelectItem value="5">5 retries</SelectItem>
                      <SelectItem value="10">10 retries</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Retry Delay</Label>
                  <Select
                    value={String(newWebhook.retryDelay)}
                    onValueChange={(value) =>
                      setNewWebhook((prev) => ({ ...prev, retryDelay: parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1000">1 second</SelectItem>
                      <SelectItem value="5000">5 seconds</SelectItem>
                      <SelectItem value="10000">10 seconds</SelectItem>
                      <SelectItem value="30000">30 seconds</SelectItem>
                      <SelectItem value="60000">1 minute</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={createWebhook}
                disabled={!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0}
              >
                Create Webhook
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
