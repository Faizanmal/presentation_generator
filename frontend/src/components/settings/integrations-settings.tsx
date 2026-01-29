'use client';

import { useState } from 'react';
import {
  Video,
  MessageSquare,
  Users,
  Cloud,
  Palette,
  FileText,
  Check,
  Loader2,
  ExternalLink,
  Unplug,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIntegrations, type IntegrationProvider } from '@/hooks/use-integrations';
import { cn } from '@/lib/utils';

interface IntegrationConfig {
  provider: IntegrationProvider;
  name: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  features: string[];
}

const integrations: IntegrationConfig[] = [
  {
    provider: 'zoom',
    name: 'Zoom',
    description: 'Present directly in Zoom meetings',
    icon: Video,
    iconColor: 'text-blue-500',
    features: ['Create meetings', 'Share presentations', 'Live presenting'],
  },
  {
    provider: 'slack',
    name: 'Slack',
    description: 'Share presentations in Slack channels',
    icon: MessageSquare,
    iconColor: 'text-purple-500',
    features: ['Share to channels', 'Notifications', 'Quick preview'],
  },
  {
    provider: 'teams',
    name: 'Microsoft Teams',
    description: 'Integrate with Microsoft Teams',
    icon: Users,
    iconColor: 'text-indigo-500',
    features: ['Create meetings', 'Share in channels', 'Co-authoring'],
  },
  {
    provider: 'google_drive',
    name: 'Google Drive',
    description: 'Sync with Google Drive',
    icon: Cloud,
    iconColor: 'text-yellow-500',
    features: ['Export to Slides', 'Import files', 'Auto backup'],
  },
  {
    provider: 'figma',
    name: 'Figma',
    description: 'Import designs from Figma',
    icon: Palette,
    iconColor: 'text-pink-500',
    features: ['Import frames', 'Sync designs', 'Live updates'],
  },
  {
    provider: 'notion',
    name: 'Notion',
    description: 'Connect with Notion pages',
    icon: FileText,
    iconColor: 'text-gray-700',
    features: ['Import pages', 'Export as page', 'Embed presentations'],
  },
];

export function IntegrationsSettings() {
  const {
    integrations: connectedIntegrations,
    isLoading,
    connectIntegration,
    disconnectIntegration,
    isDisconnecting,
    isConnected,
  } = useIntegrations();

  const [disconnectDialog, setDisconnectDialog] = useState<{
    open: boolean;
    provider: IntegrationProvider | null;
    name: string;
  }>({ open: false, provider: null, name: '' });

  const handleDisconnect = () => {
    if (!disconnectDialog.provider) return;
    const integration = connectedIntegrations?.find(
      (i) => i.provider === disconnectDialog.provider
    );
    if (integration) {
      disconnectIntegration(integration.id);
    }
    setDisconnectDialog({ open: false, provider: null, name: '' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Integrations</h2>
        <p className="text-muted-foreground">
          Connect your favorite tools to enhance your workflow
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => {
          const connected = isConnected(integration.provider);
          const Icon = integration.icon;

          return (
            <Card key={integration.provider} className={cn(connected && 'border-primary/50')}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        connected ? 'bg-primary/10' : 'bg-muted'
                      )}
                    >
                      <Icon className={cn('w-5 h-5', integration.iconColor)} />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {integration.name}
                        {connected && (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                      </CardTitle>
                    </div>
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {integration.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Features */}
                <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                  {integration.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {connected ? (
                    <>
                      <Button variant="outline" size="sm" className="flex-1">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Settings
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDisconnectDialog({
                            open: true,
                            provider: integration.provider,
                            name: integration.name,
                          })
                        }
                      >
                        <Unplug className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => connectIntegration(integration.provider)}
                    >
                      Connect {integration.name}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Disconnect confirmation dialog */}
      <AlertDialog
        open={disconnectDialog.open}
        onOpenChange={(open) =>
          setDisconnectDialog({ ...disconnectDialog, open })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {disconnectDialog.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection to {disconnectDialog.name}. You can
              reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
