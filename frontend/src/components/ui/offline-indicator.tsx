'use client';

import { Wifi, WifiOff, RefreshCw, CloudOff, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { useOffline } from '@/hooks/use-offline';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { status, syncChanges } = useOffline();

  if (status.isOnline && status.pendingChanges === 0 && status.conflicts.length === 0) {
    return null; // Don't show anything when everything is synced
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-2',
            !status.isOnline && 'text-amber-500',
            status.conflicts.length > 0 && 'text-red-500'
          )}
        >
          {!status.isOnline ? (
            <WifiOff className="w-4 h-4" />
          ) : status.isSyncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : status.conflicts.length > 0 ? (
            <AlertTriangle className="w-4 h-4" />
          ) : status.pendingChanges > 0 ? (
            <CloudOff className="w-4 h-4" />
          ) : (
            <Check className="w-4 h-4 text-green-500" />
          )}
          
          {status.pendingChanges > 0 && (
            <Badge variant="secondary" className="px-1.5">
              {status.pendingChanges}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Connection status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {status.isOnline ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-500" />
              )}
              <span className="font-medium">
                {status.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            {status.lastSyncedAt && (
              <span className="text-xs text-muted-foreground">
                Last synced: {new Date(status.lastSyncedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Pending changes */}
          {status.pendingChanges > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Pending changes</span>
                <span className="font-medium">{status.pendingChanges}</span>
              </div>
              {status.isSyncing && (
                <Progress value={30} className="h-1" />
              )}
            </div>
          )}

          {/* Conflicts */}
          {status.conflicts.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">
                  {status.conflicts.length} conflict(s) detected
                </span>
              </div>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                Review and resolve conflicts to sync your changes
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {status.isOnline && status.pendingChanges > 0 && (
              <Button
                size="sm"
                className="flex-1"
                onClick={syncChanges}
                disabled={status.isSyncing}
              >
                {status.isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Offline mode info */}
          {!status.isOnline && (
            <p className="text-xs text-muted-foreground">
              Your changes are being saved locally and will sync when you&apos;re back online.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
