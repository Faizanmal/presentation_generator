"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  History,
  Clock,
  User,
  ArrowLeft,
  ArrowRight,
  Download,
  Eye,
  RotateCcw,
  ChevronDown,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Version {
  id: string;
  number: number;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    avatar?: string;
  };
  changesSummary: string;
  slideCount: number;
  isAutosave: boolean;
  isCurrent: boolean;
}

interface VersionHistoryProps {
  projectId: string;
  versions: Version[];
  onRestore: (versionId: string) => void;
  onPreview: (versionId: string) => void;
  onDownload: (versionId: string) => void;
  isLoading?: boolean;
}

export function VersionHistory({
  projectId,
  versions,
  onRestore,
  onPreview,
  onDownload,
  isLoading = false,
}: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[string, string] | null>(null);

  const currentVersion = versions.find((v) => v.isCurrent);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">History</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-96 sm:w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </SheetTitle>
          <SheetDescription>
            View and restore previous versions of your presentation
          </SheetDescription>
        </SheetHeader>

        {/* Current Version Info */}
        {currentVersion && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-600">Current</Badge>
              <span className="text-sm font-medium">
                Version {currentVersion.number}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Last saved {formatDistanceToNow(new Date(currentVersion.createdAt))} ago
            </p>
          </div>
        )}

        {/* Version List */}
        <ScrollArea className="flex-1 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 mt-2">No versions yet</p>
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {versions.map((version, index) => (
                <VersionItem
                  key={version.id}
                  version={version}
                  isSelected={selectedVersion === version.id}
                  onSelect={() => setSelectedVersion(version.id)}
                  onRestore={() => onRestore(version.id)}
                  onPreview={() => onPreview(version.id)}
                  onDownload={() => onDownload(version.id)}
                  showConnector={index < versions.length - 1}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <div className="pt-4 border-t mt-4">
          <p className="text-xs text-slate-500 text-center">
            Versions are kept for 30 days. Pro users get unlimited history.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Individual version item
function VersionItem({
  version,
  isSelected,
  onSelect,
  onRestore,
  onPreview,
  onDownload,
  showConnector,
}: {
  version: Version;
  isSelected: boolean;
  onSelect: () => void;
  onRestore: () => void;
  onPreview: () => void;
  onDownload: () => void;
  showConnector: boolean;
}) {
  return (
    <div className="relative">
      {/* Timeline connector */}
      {showConnector && (
        <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
      )}

      <div
        onClick={onSelect}
        className={cn(
          "relative flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
          isSelected
            ? "bg-slate-100 dark:bg-slate-800"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
          version.isCurrent && "ring-1 ring-blue-500"
        )}
      >
        {/* Timeline dot */}
        <div
          className={cn(
            "relative z-10 h-4 w-4 rounded-full border-2 mt-1 flex-shrink-0",
            version.isCurrent
              ? "bg-blue-500 border-blue-500"
              : version.isAutosave
                ? "bg-slate-300 border-slate-300 dark:bg-slate-600 dark:border-slate-600"
                : "bg-white dark:bg-slate-900 border-slate-400"
          )}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white">
              Version {version.number}
            </span>
            {version.isCurrent && (
              <Badge variant="secondary" className="text-xs">
                Current
              </Badge>
            )}
            {version.isAutosave && (
              <Badge variant="outline" className="text-xs">
                Autosave
              </Badge>
            )}
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {version.changesSummary}
          </p>

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(version.createdAt))} ago
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {version.createdBy.name}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {version.slideCount} slides
            </span>
          </div>

          {/* Actions (show when selected) */}
          {isSelected && !version.isCurrent && (
            <div className="flex items-center gap-2 mt-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={onPreview}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Preview this version</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={onDownload}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download as copy</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" onClick={onRestore}>
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restore
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restore this version</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Auto-save Status Indicator
interface AutoSaveStatusProps {
  status: "saved" | "saving" | "error" | "offline";
  lastSaved?: Date;
  onRetry?: () => void;
}

export function AutoSaveStatus({ status, lastSaved, onRetry }: AutoSaveStatusProps) {
  const statusConfig = {
    saved: {
      icon: CheckCircle,
      text: "Saved",
      className: "text-green-600",
      showTime: true,
    },
    saving: {
      icon: Loader2,
      text: "Saving...",
      className: "text-blue-600 animate-spin",
      showTime: false,
    },
    error: {
      icon: AlertCircle,
      text: "Save failed",
      className: "text-red-600",
      showTime: false,
    },
    offline: {
      icon: AlertCircle,
      text: "Offline",
      className: "text-yellow-600",
      showTime: false,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={cn("h-4 w-4", config.className)} />
      <span className="text-slate-600 dark:text-slate-400">
        {config.text}
        {config.showTime && lastSaved && (
          <span className="ml-1">
            {formatDistanceToNow(lastSaved, { addSuffix: true })}
          </span>
        )}
      </span>
      {status === "error" && onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="h-6 px-2">
          Retry
        </Button>
      )}
    </div>
  );
}

// Hook for auto-save
export function useAutoSave(
  data: any,
  saveFunction: (data: any) => Promise<void>,
  options: {
    interval?: number; // ms between saves
    onError?: (error: Error) => void;
    enabled?: boolean;
  } = {}
) {
  const { interval = 30000, onError, enabled = true } = options;
  const [status, setStatus] = useState<"saved" | "saving" | "error" | "offline">("saved");
  const [lastSaved, setLastSaved] = useState<Date | undefined>();
  const dataRef = useRef(data);
  const lastSavedDataRef = useRef<string>("");

  // Update ref when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Auto-save effect
  useEffect(() => {
    if (!enabled) return;

    const save = async () => {
      const currentData = JSON.stringify(dataRef.current);

      // Skip if data hasn't changed
      if (currentData === lastSavedDataRef.current) return;

      // Check online status
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }

      setStatus("saving");
      try {
        await saveFunction(dataRef.current);
        lastSavedDataRef.current = currentData;
        setStatus("saved");
        setLastSaved(new Date());
      } catch (error) {
        setStatus("error");
        onError?.(error as Error);
      }
    };

    const intervalId = setInterval(save, interval);
    return () => clearInterval(intervalId);
  }, [enabled, interval, saveFunction, onError]);

  // Manual save function
  const save = useCallback(async () => {
    setStatus("saving");
    try {
      await saveFunction(dataRef.current);
      lastSavedDataRef.current = JSON.stringify(dataRef.current);
      setStatus("saved");
      setLastSaved(new Date());
    } catch (error) {
      setStatus("error");
      onError?.(error as Error);
    }
  }, [saveFunction, onError]);

  return { status, lastSaved, save };
}
