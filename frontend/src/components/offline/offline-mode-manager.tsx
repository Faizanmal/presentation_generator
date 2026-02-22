'use client';

import { useOfflineMode } from '@/hooks/use-offline-mode';
import { useServiceWorker } from '@/hooks/use-service-worker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  Trash2,
  Download,
  HardDrive,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface OfflineModeManagerProps {
  onOpenPresentation?: (id: string) => void;
}

export function OfflineModeManager({ onOpenPresentation }: OfflineModeManagerProps) {
  const {
    isOnline,
    syncStatus,
    syncProgress,
    pendingChanges,
    offlinePresentations,
    triggerSync,
    removeFromOffline,
    storageStats,
  } = useOfflineMode();

  const {
    isSupported: swSupported,
    isInstalled: swInstalled,
    isUpdateAvailable,
    skipWaiting,
    checkForUpdate,
  } = useServiceWorker();

  const getStatusIcon = () => {
    if (!isOnline) {return <WifiOff className="h-4 w-4 text-red-500" />;}
    if (syncStatus === 'syncing') {return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;}
    if (syncStatus === 'error') {return <AlertCircle className="h-4 w-4 text-yellow-500" />;}
    if (pendingChanges > 0) {return <Cloud className="h-4 w-4 text-yellow-500" />;}
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!isOnline) {return 'Offline';}
    if (syncStatus === 'syncing') {return 'Syncing...';}
    if (syncStatus === 'error') {return 'Sync Error';}
    if (pendingChanges > 0) {return `${pendingChanges} pending`;}
    return 'All synced';
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {getStatusIcon()}
          <span className="hidden sm:inline">{getStatusText()}</span>
          {pendingChanges > 0 && (
            <Badge variant="secondary" className="ml-1">
              {pendingChanges}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            Offline Mode
          </DialogTitle>
          <DialogDescription>
            Manage offline access and sync your presentations
          </DialogDescription>
        </DialogHeader>

        {/* Status Banner */}
        <div
          className={`p-3 rounded-lg flex items-center justify-between ${
            isOnline ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4" />
                <span>You are online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>You are offline - changes will sync when reconnected</span>
              </>
            )}
          </div>
          {isOnline && (
            <Button
              variant="ghost"
              size="sm"
              onClick={triggerSync}
              disabled={syncStatus === 'syncing'}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
          )}
        </div>

        {/* Sync Progress */}
        {syncStatus === 'syncing' && syncProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Syncing...</span>
              <span>
                {syncProgress.completed}/{syncProgress.total}
              </span>
            </div>
            <Progress
              value={syncProgress.total > 0 ? (syncProgress.completed / syncProgress.total) * 100 : 0}
            />
            {syncProgress.currentItem && (
              <p className="text-xs text-muted-foreground">
                Currently syncing: {syncProgress.currentItem}
              </p>
            )}
          </div>
        )}

        {/* Update Available */}
        {isUpdateAvailable && (
          <div className="p-3 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span>A new version is available</span>
            </div>
            <Button variant="ghost" size="sm" onClick={skipWaiting}>
              Update Now
            </Button>
          </div>
        )}

        <Tabs defaultValue="presentations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="presentations">
              Offline Presentations ({offlinePresentations.length})
            </TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
          </TabsList>

          <TabsContent value="presentations">
            <ScrollArea className="h-75">
              {offlinePresentations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CloudOff className="h-12 w-12 mb-4" />
                  <p className="text-center">
                    No presentations saved for offline access.
                    <br />
                    Open a presentation and save it for offline use.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {offlinePresentations.map((presentation) => (
                    <div
                      key={presentation.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => onOpenPresentation?.(presentation.projectId)}
                      >
                        <div className="p-2 bg-muted rounded">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{presentation.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{presentation.slideCount} slides</span>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(presentation.lastModified, { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {presentation.synced ? (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Synced
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromOffline(presentation.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="storage">
            <div className="space-y-4">
              {/* Storage Stats */}
              {storageStats && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Presentations</span>
                    </div>
                    <p className="text-2xl font-bold">{storageStats.presentations}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Cloud className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Pending Changes</span>
                    </div>
                    <p className="text-2xl font-bold">{storageStats.pendingChanges}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Storage Used</span>
                    </div>
                    <p className="text-2xl font-bold">{storageStats.storageUsed}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Last Sync</span>
                    </div>
                    <p className="text-lg font-semibold">
                      {storageStats.lastSync
                        ? formatDistanceToNow(storageStats.lastSync, { addSuffix: true })
                        : 'Never'}
                    </p>
                  </div>
                </div>
              )}

              {/* Service Worker Status */}
              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Service Worker</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supported</span>
                    <span>{swSupported ? '✓ Yes' : '✗ No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Installed</span>
                    <span>{swInstalled ? '✓ Yes' : '✗ No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Update Available</span>
                    <span>{isUpdateAvailable ? '✓ Yes' : 'No'}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={checkForUpdate}
                >
                  Check for Updates
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
