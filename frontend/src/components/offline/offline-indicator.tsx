'use client';

import { useOfflineMode } from '@/hooks/use-offline-mode';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WifiOff, Cloud, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface OfflineIndicatorProps {
  variant?: 'full' | 'compact' | 'minimal';
  showPendingCount?: boolean;
}

export function OfflineIndicator({ variant = 'compact', showPendingCount = true }: OfflineIndicatorProps) {
  const { isOnline, syncStatus, pendingChanges } = useOfflineMode();

  const getIcon = () => {
    if (!isOnline) {return <WifiOff className="h-4 w-4" />;}
    if (syncStatus === 'syncing') {return <RefreshCw className="h-4 w-4 animate-spin" />;}
    if (syncStatus === 'error') {return <AlertCircle className="h-4 w-4" />;}
    if (pendingChanges > 0) {return <Cloud className="h-4 w-4" />;}
    return <CheckCircle className="h-4 w-4" />;
  };

  const getColor = () => {
    if (!isOnline) {return 'text-red-500';}
    if (syncStatus === 'syncing') {return 'text-blue-500';}
    if (syncStatus === 'error') {return 'text-yellow-500';}
    if (pendingChanges > 0) {return 'text-yellow-500';}
    return 'text-green-500';
  };

  const getLabel = () => {
    if (!isOnline) {return 'Offline';}
    if (syncStatus === 'syncing') {return 'Syncing...';}
    if (syncStatus === 'error') {return 'Sync Error';}
    if (pendingChanges > 0) {return `${pendingChanges} pending`;}
    return 'Synced';
  };

  const getTooltip = () => {
    if (!isOnline) {return 'You are offline. Changes will sync when reconnected.';}
    if (syncStatus === 'syncing') {return 'Syncing your changes...';}
    if (syncStatus === 'error') {return 'Failed to sync. Will retry automatically.';}
    if (pendingChanges > 0) {return `${pendingChanges} change(s) waiting to sync.`;}
    return 'All changes are synced.';
  };

  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`cursor-default ${getColor()}`}>{getIcon()}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltip()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 ${getColor()}`}>
              {getIcon()}
              {showPendingCount && pendingChanges > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {pendingChanges}
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltip()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full variant
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
      !isOnline ? 'bg-red-100' : 
      syncStatus === 'error' ? 'bg-yellow-100' :
      pendingChanges > 0 ? 'bg-yellow-50' :
      'bg-green-50'
    }`}>
      <span className={getColor()}>{getIcon()}</span>
      <span className={`text-sm font-medium ${getColor()}`}>{getLabel()}</span>
    </div>
  );
}
