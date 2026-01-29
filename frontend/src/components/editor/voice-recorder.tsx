'use client';

import { useState } from 'react';
import { Mic, Square, Pause, Play, Upload, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  projectId?: string;
  onSlidesGenerated?: (slides: any[]) => void;
  className?: string;
}

export function VoiceRecorder({
  projectId,
  onSlidesGenerated,
  className,
}: VoiceRecorderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'record' | 'transcription' | 'generate'>('record');
  const [options, setOptions] = useState({
    tone: 'professional',
    audience: 'general',
    length: 10,
  });

  const {
    isRecording,
    isPaused,
    isProcessing,
    duration,
    formattedDuration,
    audioBlob,
    transcription,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    uploadAndTranscribe,
    generateSlides,
  } = useVoiceRecorder({
    maxDuration: 600, // 10 minutes
    onTranscription: (text) => {
      setStep('transcription');
    },
  });

  const handleStartRecording = async () => {
    await startRecording();
  };

  const handleStopAndTranscribe = async () => {
    stopRecording();
    setTimeout(async () => {
      const result = await uploadAndTranscribe(projectId);
      if (result) {
        setStep('transcription');
      }
    }, 500);
  };

  const handleGenerateSlides = async () => {
    setStep('generate');
    // In real implementation, use the recording ID from uploadAndTranscribe
    const result = await generateSlides('recording-id', options);
    if (result && onSlidesGenerated) {
      onSlidesGenerated(result.slides);
      setIsOpen(false);
      resetState();
    }
  };

  const resetState = () => {
    setStep('record');
    cancelRecording();
  };

  const handleClose = () => {
    resetState();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn('gap-2', className)}
          onClick={() => setIsOpen(true)}
        >
          <Mic className="w-4 h-4" />
          Voice to Slides
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Voice to Slides
          </DialogTitle>
          <DialogDescription>
            {step === 'record' && 'Record your voice and we\'ll generate slides from your speech.'}
            {step === 'transcription' && 'Review the transcription before generating slides.'}
            {step === 'generate' && 'Generating slides from your transcription...'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {step === 'record' && (
            <RecordingStep
              isRecording={isRecording}
              isPaused={isPaused}
              isProcessing={isProcessing}
              duration={duration}
              formattedDuration={formattedDuration}
              audioBlob={audioBlob}
              onStart={handleStartRecording}
              onPause={pauseRecording}
              onResume={resumeRecording}
              onStop={handleStopAndTranscribe}
              onCancel={cancelRecording}
            />
          )}

          {step === 'transcription' && (
            <TranscriptionStep
              transcription={transcription || ''}
              options={options}
              onOptionsChange={setOptions}
              onBack={() => setStep('record')}
            />
          )}

          {step === 'generate' && (
            <GeneratingStep />
          )}
        </div>

        <DialogFooter>
          {step === 'record' && audioBlob && !isRecording && (
            <Button onClick={handleStopAndTranscribe} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Transcribe
                </>
              )}
            </Button>
          )}

          {step === 'transcription' && (
            <Button onClick={handleGenerateSlides}>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Slides
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RecordingStepProps {
  isRecording: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  duration: number;
  formattedDuration: string;
  audioBlob: Blob | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}

function RecordingStep({
  isRecording,
  isPaused,
  isProcessing,
  duration,
  formattedDuration,
  audioBlob,
  onStart,
  onPause,
  onResume,
  onStop,
  onCancel,
}: RecordingStepProps) {
  const maxDuration = 600; // 10 minutes

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Visualization */}
      <div className="relative w-32 h-32">
        <div
          className={cn(
            'absolute inset-0 rounded-full flex items-center justify-center',
            isRecording && !isPaused
              ? 'bg-red-100 animate-pulse'
              : 'bg-muted'
          )}
        >
          <div
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center',
              isRecording && !isPaused
                ? 'bg-red-500'
                : 'bg-primary'
            )}
          >
            <Mic className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* Duration */}
      <div className="text-center">
        <p className="text-3xl font-mono font-bold">{formattedDuration}</p>
        <p className="text-sm text-muted-foreground">
          {isRecording ? (isPaused ? 'Paused' : 'Recording...') : 'Ready to record'}
        </p>
      </div>

      {/* Progress bar */}
      {isRecording && (
        <Progress value={(duration / maxDuration) * 100} className="w-full" />
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {!isRecording && !audioBlob && (
          <Button size="lg" onClick={onStart}>
            <Mic className="w-5 h-5 mr-2" />
            Start Recording
          </Button>
        )}

        {isRecording && (
          <>
            {isPaused ? (
              <Button size="lg" onClick={onResume}>
                <Play className="w-5 h-5 mr-2" />
                Resume
              </Button>
            ) : (
              <Button size="lg" variant="outline" onClick={onPause}>
                <Pause className="w-5 h-5 mr-2" />
                Pause
              </Button>
            )}

            <Button size="lg" variant="destructive" onClick={onStop}>
              <Square className="w-5 h-5 mr-2" />
              Stop
            </Button>
          </>
        )}

        {audioBlob && !isRecording && (
          <Button variant="ghost" onClick={onCancel}>
            Re-record
          </Button>
        )}
      </div>

      {/* Tips */}
      <div className="text-center text-sm text-muted-foreground max-w-sm">
        <p>Tips for best results:</p>
        <ul className="mt-2 space-y-1">
          <li>• Speak clearly and at a steady pace</li>
          <li>• Pause briefly between main points</li>
          <li>• Mention transitions like &quot;next slide&quot;</li>
        </ul>
      </div>
    </div>
  );
}

interface TranscriptionStepProps {
  transcription: string;
  options: {
    tone: string;
    audience: string;
    length: number;
  };
  onOptionsChange: (options: any) => void;
  onBack: () => void;
}

function TranscriptionStep({
  transcription,
  options,
  onOptionsChange,
  onBack,
}: TranscriptionStepProps) {
  return (
    <div className="space-y-4">
      {/* Transcription preview */}
      <div>
        <Label>Transcription</Label>
        <Textarea
          value={transcription}
          readOnly
          className="mt-1.5 h-32 resize-none"
        />
      </div>

      {/* Generation options */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="tone">Tone</Label>
          <Select
            value={options.tone}
            onValueChange={(value) =>
              onOptionsChange({ ...options, tone: value })
            }
          >
            <SelectTrigger id="tone" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="academic">Academic</SelectItem>
              <SelectItem value="creative">Creative</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="audience">Audience</Label>
          <Select
            value={options.audience}
            onValueChange={(value) =>
              onOptionsChange({ ...options, audience: value })
            }
          >
            <SelectTrigger id="audience" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="executive">Executive</SelectItem>
              <SelectItem value="students">Students</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="length">Target Slides: {options.length}</Label>
        <input
          type="range"
          id="length"
          min="3"
          max="30"
          value={options.length}
          onChange={(e) =>
            onOptionsChange({ ...options, length: parseInt(e.target.value) })
          }
          className="w-full mt-1.5"
        />
      </div>

      <Button variant="ghost" onClick={onBack}>
        ← Re-record
      </Button>
    </div>
  );
}

function GeneratingStep() {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <div className="text-center">
        <p className="font-medium">Generating your slides...</p>
        <p className="text-sm text-muted-foreground">
          This may take a moment
        </p>
      </div>
    </div>
  );
}
