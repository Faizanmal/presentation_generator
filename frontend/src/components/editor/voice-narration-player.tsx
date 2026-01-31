/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Loader2,
  Wand2,
  Settings,
  RefreshCw,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface VoiceNarrationPlayerProps {
  slideContent: string;
  slideId: string;
  projectId: string;
  existingAudioUrl?: string;
  onAudioGenerated?: (audioUrl: string) => void;
  className?: string;
}

type Voice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

const VOICES: Array<{ id: Voice; name: string; description: string }> = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
  { id: 'echo', name: 'Echo', description: 'Warm and conversational' },
  { id: 'fable', name: 'Fable', description: 'Expressive and dramatic' },
  { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
  { id: 'nova', name: 'Nova', description: 'Friendly and upbeat' },
  { id: 'shimmer', name: 'Shimmer', description: 'Clear and professional' },
];

export function VoiceNarrationPlayer({
  slideContent,
  slideId,
  projectId,
  existingAudioUrl,
  onAudioGenerated,
  className,
}: VoiceNarrationPlayerProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(existingAudioUrl || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedVoice, setSelectedVoice] = useState<Voice>('nova');
  const [showSettings, setShowSettings] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const generateNarration = async () => {
    if (!slideContent.trim()) {
      toast.error('No content to narrate');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await api.generateVoiceNarration(slideContent, {
        voice: selectedVoice,
        speed: playbackSpeed,
      });

      setAudioUrl(response.audioUrl);
      setDuration(response.duration);
      onAudioGenerated?.(response.audioUrl);
      toast.success('Narration generated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate narration');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5);
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `narration-${slideId}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
      )}

      {!audioUrl ? (
        // Generate narration UI
        <div className="p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="text-center">
            <Volume2 className="h-8 w-8 mx-auto mb-2 text-slate-400" />
            <h4 className="font-medium mb-1">Voice Narration</h4>
            <p className="text-sm text-slate-500 mb-4">
              Generate AI voice narration for this slide
            </p>
            
            <div className="flex items-center justify-center gap-2 mb-4">
              <Select value={selectedVoice} onValueChange={(v) => setSelectedVoice(v as Voice)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {VOICES.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <div>
                        <span className="font-medium">{voice.name}</span>
                        <span className="text-xs text-slate-500 ml-2">{voice.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generateNarration} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Narration
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        // Audio player UI
        <div className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50">
          {/* Progress bar */}
          <div className="mb-3">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={skipBackward}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="icon"
                className="h-10 w-10"
                onClick={handlePlayPause}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={skipForward}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Volume control */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    {isMuted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-32" align="end">
                  <div className="space-y-2">
                    <Label className="text-xs">Volume</Label>
                    <Slider
                      value={[volume * 100]}
                      max={100}
                      step={1}
                      onValueChange={(v) => setVolume(v[0] / 100)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setIsMuted(!isMuted)}
                    >
                      {isMuted ? 'Unmute' : 'Mute'}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Speed control */}
              <Select
                value={playbackSpeed.toString()}
                onValueChange={(v) => setPlaybackSpeed(parseFloat(v))}
              >
                <SelectTrigger className="w-16 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5x</SelectItem>
                  <SelectItem value="0.75">0.75x</SelectItem>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="1.25">1.25x</SelectItem>
                  <SelectItem value="1.5">1.5x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                </SelectContent>
              </Select>

              {/* Download */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={downloadAudio}
              >
                <Download className="h-4 w-4" />
              </Button>

              {/* Regenerate */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={generateNarration}
                disabled={isGenerating}
              >
                <RefreshCw className={cn('h-4 w-4', isGenerating && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Batch narration generator for entire presentation
interface BatchNarrationGeneratorProps {
  projectId: string;
  slides: Array<{ id: string; content: string; title: string }>;
  onComplete?: (audioUrls: Map<string, string>) => void;
}

export function BatchNarrationGenerator({
  projectId,
  slides,
  onComplete,
}: BatchNarrationGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSlide, setCurrentSlide] = useState<string | null>(null);
  const [completedSlides, setCompletedSlides] = useState<Set<string>>(new Set());
  const [selectedVoice, setSelectedVoice] = useState<Voice>('nova');
  const [audioUrls, setAudioUrls] = useState<Map<string, string>>(new Map());

  const generateAll = async () => {
    setIsGenerating(true);
    setProgress(0);
    setCompletedSlides(new Set());
    const newAudioUrls = new Map<string, string>();

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      setCurrentSlide(slide.id);

      try {
        const response = await api.generateVoiceNarration(slide.content, {
          voice: selectedVoice,
        });

        newAudioUrls.set(slide.id, response.audioUrl);
        setCompletedSlides((prev) => new Set([...prev, slide.id]));
      } catch (error) {
        console.error(`Failed to generate narration for slide ${slide.id}`, error);
      }

      setProgress(((i + 1) / slides.length) * 100);
    }

    setAudioUrls(newAudioUrls);
    setIsGenerating(false);
    setCurrentSlide(null);
    onComplete?.(newAudioUrls);
    toast.success(`Generated narration for ${newAudioUrls.size} slides`);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Volume2 className="h-4 w-4 mr-2" />
          Generate All Narrations
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Voice Narration</DialogTitle>
          <DialogDescription>
            Generate AI voice narration for all {slides.length} slides in your presentation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Voice</Label>
            <Select
              value={selectedVoice}
              onValueChange={(v) => setSelectedVoice(v as Voice)}
              disabled={isGenerating}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{voice.name}</span>
                      <span className="text-xs text-slate-500">— {voice.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isGenerating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Generating narrations...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
              {currentSlide && (
                <p className="text-xs text-slate-500">
                  Processing: {slides.find((s) => s.id === currentSlide)?.title || currentSlide}
                </p>
              )}
            </div>
          )}

          {!isGenerating && completedSlides.size > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-green-600">
                ✓ Generated {completedSlides.size} of {slides.length} narrations
              </p>
              <div className="grid grid-cols-4 gap-2">
                {slides.map((slide, i) => (
                  <div
                    key={slide.id}
                    className={cn(
                      'h-8 rounded flex items-center justify-center text-xs font-medium',
                      completedSlides.has(slide.id)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {completedSlides.has(slide.id) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={generateAll} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate All
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
