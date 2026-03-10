"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Video,
  ChevronLeft,
  Loader2,
  Play,
  Square,
  Trash2,
  Download,
  Clock,
  HardDrive,
  Film,
  Circle,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";

export default function VideoRecordingPage() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState("");

  // Fetch projects for selector
  const { data: projects } = useQuery({
    queryKey: ["projects-for-recording"],
    queryFn: () => api.projects.getAll(),
  });

  // Fetch recordings
  const { data: recordings, isLoading } = useQuery({
    queryKey: ["video-recordings"],
    queryFn: () => api.videoRecording.getRecordings(),
  });

  // Start recording mutation
  const startRecordingMutation = useMutation({
    mutationFn: (projectId: string) =>
      api.videoRecording.startRecording(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-recordings"] });
      toast.success("Recording started!");
    },
    onError: () => toast.error("Failed to start recording"),
  });

  // Stop recording mutation
  const stopRecordingMutation = useMutation({
    mutationFn: (recordingId: string) =>
      api.videoRecording.stopRecording(recordingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-recordings"] });
      toast.success("Recording stopped & processing...");
    },
    onError: () => toast.error("Failed to stop recording"),
  });

  // Delete recording mutation
  const deleteRecordingMutation = useMutation({
    mutationFn: (recordingId: string) =>
      api.videoRecording.deleteRecording(recordingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-recordings"] });
      toast.success("Recording deleted");
    },
    onError: () => toast.error("Failed to delete recording"),
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {return `${(bytes / 1024).toFixed(1)} KB`;}
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "recording":
        return (
          <Badge className="bg-red-100 text-red-700 animate-pulse">
            <Circle className="h-2 w-2 mr-1 fill-current" /> Recording
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-yellow-100 text-yellow-700">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-700">Completed</Badge>
        );
      case "failed":
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-red-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
                <div className="h-8 w-8 rounded-lg bg-linear-to-br from-red-500 to-rose-600 flex items-center justify-center">
                  <Video className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  Video Recording
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger className="w-48">
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
              <Button
                onClick={() =>
                  startRecordingMutation.mutate(selectedProjectId)
                }
                disabled={
                  !selectedProjectId ||
                  startRecordingMutation.isPending
                }
              >
                {startRecordingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 mr-2 fill-red-500 text-red-500" />
                )}
                Start Recording
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Recordings</CardTitle>
            <CardDescription>
              Your recorded presentation videos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !recordings?.length ? (
              <div className="text-center py-12">
                <Film className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">No Recordings</h3>
                <p className="text-muted-foreground">
                  Select a presentation and start recording.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recordings.map(
                  (rec: {
                    id: string;
                    projectTitle?: string;
                    status: string;
                    duration?: number;
                    fileSize?: number;
                    videoUrl?: string;
                    thumbnailUrl?: string;
                    createdAt: string;
                  }) => (
                    <Card key={rec.id} className="overflow-hidden">
                      <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        {rec.thumbnailUrl ? (
                          <Image
                            src={rec.thumbnailUrl}
                            alt={rec.projectTitle || "Recording"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Video className="h-12 w-12 text-slate-300" />
                        )}
                        {rec.status === "completed" && rec.videoUrl && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute inset-0 m-auto w-12 h-12 rounded-full"
                            onClick={() =>
                              window.open(rec.videoUrl, "_blank")
                            }
                          >
                            <Play className="h-5 w-5" />
                          </Button>
                        )}
                        <div className="absolute top-2 right-2">
                          {getStatusBadge(rec.status)}
                        </div>
                      </div>
                      <CardContent className="pt-4">
                        <h3 className="font-medium truncate">
                          {rec.projectTitle || "Untitled Recording"}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {rec.duration != null && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />{" "}
                              {formatDuration(rec.duration)}
                            </span>
                          )}
                          {rec.fileSize != null && (
                            <span className="flex items-center gap-1">
                              <HardDrive className="h-3 w-3" />{" "}
                              {formatSize(rec.fileSize)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(rec.createdAt).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          {rec.status === "recording" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                stopRecordingMutation.mutate(rec.id)
                              }
                              disabled={stopRecordingMutation.isPending}
                            >
                              <Square className="h-3 w-3 mr-1" /> Stop
                            </Button>
                          )}
                          {rec.status === "completed" && rec.videoUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(rec.videoUrl, "_blank")
                              }
                            >
                              <Download className="h-3 w-3 mr-1" />{" "}
                              Download
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Recording?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the
                                  recording and its video file.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    deleteRecordingMutation.mutate(
                                      rec.id
                                    )
                                  }
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
