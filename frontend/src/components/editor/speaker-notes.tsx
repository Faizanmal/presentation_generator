"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
    Mic,
    MicOff,
    Play,
    Pause,
    Trash2,
    Save,
    Loader2,
    Volume2,
    Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SpeakerNotesProps {
    slideId: string;
    slideContent: string;
    initialNotes?: string;
    onSave: (notes: string) => void;
}

export function SpeakerNotesPanel({
    slideId,
    slideContent,
    initialNotes = "",
    onSave,
}: SpeakerNotesProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notes, setNotes] = useState(initialNotes);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Update notes when initial value changes
    useEffect(() => {
        setNotes(initialNotes);
    }, [initialNotes]);

    // Generate AI speaker notes
    const aiGenerateMutation = useMutation({
        mutationFn: async () => {
            const response = await api.generateSpeakerNotes(slideContent);
            return response.notes;
        },
        onSuccess: (generatedNotes) => {
            setNotes(generatedNotes);
            toast.success("Speaker notes generated!");
        },
        onError: () => {
            toast.error("Failed to generate speaker notes");
        },
    });

    // Start recording
    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                setRecordedAudio(blob);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setDuration(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setDuration((prev) => prev + 1);
            }, 1000);
        } catch {
            toast.error("Could not access microphone");
        }
    }, []);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [isRecording]);

    // Play recorded audio
    const playAudio = useCallback(() => {
        if (recordedAudio) {
            if (!audioRef.current) {
                audioRef.current = new Audio();
                audioRef.current.onended = () => setIsPlaying(false);
            }
            audioRef.current.src = URL.createObjectURL(recordedAudio);
            audioRef.current.play();
            setIsPlaying(true);
        }
    }, [recordedAudio]);

    // Pause audio
    const pauseAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    }, []);

    // Delete recording
    const deleteRecording = useCallback(() => {
        setRecordedAudio(null);
        setDuration(0);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    }, []);

    // Format duration
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    // Handle save
    const handleSave = () => {
        onSave(notes);
        toast.success("Speaker notes saved!");
    };

    // Word count
    const wordCount = notes.trim().split(/\s+/).filter(Boolean).length;
    const estimatedTime = Math.ceil(wordCount / 150); // ~150 words per minute speaking pace

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                    <Mic className="h-4 w-4" />
                    <span className="hidden sm:inline">Notes</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-96 sm:w-[480px] flex flex-col">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Mic className="h-5 w-5" />
                        Speaker Notes
                    </SheetTitle>
                    <SheetDescription>
                        Notes only visible to you during presentation
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 flex flex-col gap-4 mt-4 overflow-hidden">
                    {/* Notes Textarea */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add your speaker notes here...

Tips:
• Key points you want to emphasize
• Stories or examples to share
• Transition cues to next slide
• Timing reminders"
                            className="flex-1 resize-none min-h-[200px]"
                        />

                        {/* Stats */}
                        <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                            <span>{wordCount} words</span>
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                ~{estimatedTime} min speaking time
                            </span>
                        </div>
                    </div>

                    {/* AI Generate Button */}
                    <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => aiGenerateMutation.mutate()}
                        disabled={aiGenerateMutation.isPending}
                    >
                        {aiGenerateMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Mic className="h-4 w-4 text-purple-600" />
                                Generate with AI
                            </>
                        )}
                    </Button>

                    {/* Voice Recording Section */}
                    <div className="border-t pt-4">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Volume2 className="h-4 w-4" />
                            Voice Recording
                        </h4>

                        {!recordedAudio ? (
                            <Button
                                variant={isRecording ? "destructive" : "outline"}
                                className="w-full gap-2"
                                onClick={isRecording ? stopRecording : startRecording}
                            >
                                {isRecording ? (
                                    <>
                                        <MicOff className="h-4 w-4" />
                                        Stop Recording ({formatDuration(duration)})
                                    </>
                                ) : (
                                    <>
                                        <Mic className="h-4 w-4" />
                                        Record Voice Notes
                                    </>
                                )}
                            </Button>
                        ) : (
                            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={isPlaying ? pauseAudio : playAudio}
                                >
                                    {isPlaying ? (
                                        <Pause className="h-4 w-4" />
                                    ) : (
                                        <Play className="h-4 w-4" />
                                    )}
                                </Button>

                                <div className="flex-1">
                                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full">
                                        <div className="h-2 bg-blue-500 rounded-full w-0" />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {formatDuration(duration)} recorded
                                    </p>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={deleteRecording}
                                    className="text-red-600 hover:text-red-700"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Save Button */}
                    <Button onClick={handleSave} className="w-full gap-2">
                        <Save className="h-4 w-4" />
                        Save Notes
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// Compact notes indicator for slide panel
export function SpeakerNotesIndicator({
    hasNotes,
    onClick,
}: {
    hasNotes: boolean;
    onClick: () => void;
}) {
    if (!hasNotes) return null;

    return (
        <button
            onClick={onClick}
            className="absolute bottom-2 right-2 p-1 bg-white/80 dark:bg-slate-900/80 rounded text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900"
            title="Has speaker notes"
        >
            <Mic className="h-3 w-3" />
        </button>
    );
}
