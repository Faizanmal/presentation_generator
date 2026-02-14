"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Mic,
    Play,
    Pause,
    Download,
    Video,
    FileAudio,
    Loader2,
    Sparkles,
    Settings,
    Clock,
    User,
    Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

interface VoiceOption {
    id: string;
    name: string;
    gender: "male" | "female" | "neutral";
    language: string;
    accent?: string;
    preview?: string;
}

interface SlideNarration {
    slideId: string;
    slideNumber: number;
    speakerNotes: string;
    audioUrl?: string;
    duration?: number;
    status: "pending" | "generating" | "complete" | "error";
}

interface NarrationExportPanelProps {
    projectId: string;
    slides: Array<{ id: string; speakerNotes?: string }>;
}

export function NarrationExportPanel({
    projectId,
    slides,
}: NarrationExportPanelProps) {
    const queryClient = useQueryClient();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState<string>("");
    const [speed, setSpeed] = useState(1.0);
    const [pitch, setPitch] = useState(1.0);
    const [volume, setVolume] = useState(1.0);
    const [playingSlide, setPlayingSlide] = useState<string | null>(null);
    const [exportFormat, setExportFormat] = useState<"audio" | "video">("video");
    const [videoQuality, setVideoQuality] = useState<"720p" | "1080p" | "4k">("1080p");
    const [includeBackground, setIncludeBackground] = useState(true);
    const [exportProgress, setExportProgress] = useState(0);

    // Fetch voice options
    const { data: voiceOptions } = useQuery({
        queryKey: ["voice-options"],
        queryFn: () => api.getVoiceOptions(),
    });

    // Fetch narration project status
    const { data: narrationProject } = useQuery({
        queryKey: ["narration-project", projectId],
        queryFn: () => api.getNarrationProject(projectId),
    });

    // Generate speaker notes mutation
    const generateNotesMutation = useMutation({
        mutationFn: (slideId: string) => api.generateSlideSpeakerNotes(projectId, slideId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["narration-project", projectId] });
            toast.success("Speaker notes generated!");
        },
        onError: () => toast.error("Failed to generate notes"),
    });

    // Generate audio for slide mutation
    const generateAudioMutation = useMutation({
        mutationFn: ({ slideId, text, voiceId }: { slideId: string; text: string; voiceId: string }) =>
            api.generateSlideNarration(projectId, slideId, text, voiceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["narration-project", projectId] });
            toast.success("Audio generated!");
        },
        onError: () => toast.error("Failed to generate audio"),
    });

    // Export video mutation
    const exportVideoMutation = useMutation({
        mutationFn: () => api.exportNarrationVideo(projectId, {
            quality: videoQuality,
            includeNarration: true,
            format: "mp4",
        }),
        onMutate: () => {
            toast.info("Starting video export... This may take a few minutes.");
            // Simulate progress
            const interval = setInterval(() => {
                setExportProgress(prev => {
                    if (prev >= 95) {
                        clearInterval(interval);
                        return prev;
                    }
                    return prev + Math.random() * 10;
                });
            }, 1000);
        },
        onSuccess: (result) => {
            setExportProgress(100);
            toast.success("Video exported successfully!");
            // Trigger download
            if (result.downloadUrl) {
                window.open(result.downloadUrl, "_blank");
            }
            setIsExportOpen(false);
            setExportProgress(0);
        },
        onError: () => {
            toast.error("Video export failed");
            setExportProgress(0);
        },
    });

    // Mock voice options
    const mockVoices: VoiceOption[] = [
        { id: "voice-1", name: "James", gender: "male", language: "en-US", accent: "American" },
        { id: "voice-2", name: "Emma", gender: "female", language: "en-US", accent: "American" },
        { id: "voice-3", name: "Oliver", gender: "male", language: "en-GB", accent: "British" },
        { id: "voice-4", name: "Sophia", gender: "female", language: "en-GB", accent: "British" },
        { id: "voice-5", name: "Alex", gender: "neutral", language: "en-US" },
    ];

    // Mock slide narrations
    const mockNarrations: SlideNarration[] = useMemo(() => slides.map((slide, index) => ({
        slideId: slide.id,
        slideNumber: index + 1,
        speakerNotes: slide.speakerNotes || "",
        status: slide.speakerNotes ? "complete" : "pending" as const,
        duration: slide.speakerNotes ? 30 + ((index * 13) % 60) : undefined,
    })), [slides]);

    const displayVoices = voiceOptions || mockVoices;
    const displayNarrations = narrationProject?.slides || mockNarrations;

    const totalDuration = displayNarrations.reduce((sum, n) => sum + (n.duration || 0), 0);
    const completedSlides = displayNarrations.filter(n => n.status === "complete").length;

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const getGenderIcon = (gender: VoiceOption["gender"]) => {
        switch (gender) {
            case "male":
                return "👨";
            case "female":
                return "👩";
            default:
                return "🧑";
        }
    };

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    Narration
                </h3>
                <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setIsSettingsOpen(true)}>
                        <Settings className="h-4 w-4" />
                    </Button>
                    <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <Video className="h-4 w-4 mr-2" />
                                Export
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Export Narrated Presentation</DialogTitle>
                                <DialogDescription>
                                    Create a video or audio file with narration
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Export Format</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setExportFormat("video")}
                                            className={`p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${exportFormat === "video"
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                : "border-slate-200 dark:border-slate-700"
                                                }`}
                                        >
                                            <Video className="h-8 w-8 text-blue-500" />
                                            <span className="font-medium">Video (MP4)</span>
                                            <span className="text-xs text-slate-500">With slides + audio</span>
                                        </button>
                                        <button
                                            onClick={() => setExportFormat("audio")}
                                            className={`p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${exportFormat === "audio"
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                : "border-slate-200 dark:border-slate-700"
                                                }`}
                                        >
                                            <FileAudio className="h-8 w-8 text-green-500" />
                                            <span className="font-medium">Audio (MP3)</span>
                                            <span className="text-xs text-slate-500">Narration only</span>
                                        </button>
                                    </div>
                                </div>

                                {exportFormat === "video" && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Video Quality</Label>
                                            <Select value={videoQuality} onValueChange={(v) => setVideoQuality(v as typeof videoQuality)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="720p">720p HD</SelectItem>
                                                    <SelectItem value="1080p">1080p Full HD</SelectItem>
                                                    <SelectItem value="4k">4K Ultra HD</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label>Include Background Music</Label>
                                                <p className="text-xs text-slate-500">Add subtle background music</p>
                                            </div>
                                            <Switch checked={includeBackground} onCheckedChange={setIncludeBackground} />
                                        </div>
                                    </>
                                )}

                                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Estimated Duration</span>
                                        <span className="font-mono">{formatDuration(totalDuration)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-slate-500">
                                        <span>Slides with narration</span>
                                        <span>{completedSlides} / {slides.length}</span>
                                    </div>
                                </div>

                                {exportProgress > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Exporting...</span>
                                            <span>{Math.round(exportProgress)}%</span>
                                        </div>
                                        <Progress value={exportProgress} />
                                    </div>
                                )}
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsExportOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => exportVideoMutation.mutate()}
                                    disabled={exportVideoMutation.isPending || completedSlides === 0}
                                >
                                    {exportVideoMutation.isPending ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Exporting...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-4 w-4 mr-2" />
                                            Export {exportFormat === "video" ? "Video" : "Audio"}
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Voice Selection Card */}
            <Card>
                <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-500" />
                            <div>
                                <p className="text-sm font-medium">
                                    {displayVoices.find(v => v.id === selectedVoice)?.name || "Select Voice"}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {displayVoices.find(v => v.id === selectedVoice)?.accent || "No voice selected"}
                                </p>
                            </div>
                        </div>
                        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="Change" />
                            </SelectTrigger>
                            <SelectContent>
                                {displayVoices.map((voice) => (
                                    <SelectItem key={voice.id} value={voice.id}>
                                        <span className="flex items-center gap-2">
                                            {getGenderIcon(voice.gender)} {voice.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold">{completedSlides}/{slides.length}</p>
                        <p className="text-xs text-slate-500">Slides Ready</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
                    <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold">{formatDuration(totalDuration)}</p>
                        <p className="text-xs text-slate-500">Total Duration</p>
                    </CardContent>
                </Card>
            </div>

            {/* Slide Narrations */}
            <div className="space-y-2">
                <Label className="text-xs text-slate-500">Slide Narrations</Label>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {displayNarrations.map((narration) => (
                        <Card key={narration.slideId} className="overflow-hidden">
                            <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-medium text-sm">
                                        {narration.slideNumber}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm truncate">
                                            {narration.speakerNotes || "No speaker notes"}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {narration.status === "complete" ? (
                                                <>
                                                    <Badge variant="secondary" className="text-xs">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {formatDuration(narration.duration || 0)}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs text-green-600">
                                                        <Check className="h-3 w-3 mr-1" />
                                                        Ready
                                                    </Badge>
                                                </>
                                            ) : narration.status === "generating" ? (
                                                <Badge variant="secondary" className="text-xs">
                                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                    Generating...
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs text-slate-500">
                                                    Pending
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {narration.status === "complete" && narration.audioUrl && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8"
                                                onClick={() => setPlayingSlide(playingSlide === narration.slideId ? null : narration.slideId)}
                                            >
                                                {playingSlide === narration.slideId ? (
                                                    <Pause className="h-4 w-4" />
                                                ) : (
                                                    <Play className="h-4 w-4" />
                                                )}
                                            </Button>
                                        )}
                                        {!narration.speakerNotes && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8"
                                                onClick={() => generateNotesMutation.mutate(narration.slideId)}
                                                disabled={generateNotesMutation.isPending}
                                            >
                                                {generateNotesMutation.isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="h-4 w-4" />
                                                )}
                                            </Button>
                                        )}
                                        {narration.speakerNotes && narration.status !== "complete" && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8"
                                                onClick={() => generateAudioMutation.mutate({
                                                    slideId: narration.slideId,
                                                    text: narration.speakerNotes || "",
                                                    voiceId: selectedVoice,
                                                })}
                                                disabled={!selectedVoice || generateAudioMutation.isPending}
                                            >
                                                {generateAudioMutation.isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Mic className="h-4 w-4" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Generate All Button */}
            <Button
                className="w-full"
                variant="outline"
                disabled={!selectedVoice || displayNarrations.every(n => n.status === "complete")}
            >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate All Narrations
            </Button>

            {/* Voice Settings Dialog */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Voice Settings</DialogTitle>
                        <DialogDescription>
                            Customize the narration voice settings
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Speed</Label>
                                <span className="text-sm text-slate-500">{speed.toFixed(1)}x</span>
                            </div>
                            <Slider
                                value={[speed]}
                                onValueChange={([v]) => setSpeed(v)}
                                min={0.5}
                                max={2}
                                step={0.1}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Pitch</Label>
                                <span className="text-sm text-slate-500">{pitch.toFixed(1)}</span>
                            </div>
                            <Slider
                                value={[pitch]}
                                onValueChange={([v]) => setPitch(v)}
                                min={0.5}
                                max={2}
                                step={0.1}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Volume</Label>
                                <span className="text-sm text-slate-500">{Math.round(volume * 100)}%</span>
                            </div>
                            <Slider
                                value={[volume]}
                                onValueChange={([v]) => setVolume(v)}
                                min={0}
                                max={1}
                                step={0.1}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setSpeed(1.0);
                            setPitch(1.0);
                            setVolume(1.0);
                        }}>
                            Reset to Defaults
                        </Button>
                        <Button onClick={() => setIsSettingsOpen(false)}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
