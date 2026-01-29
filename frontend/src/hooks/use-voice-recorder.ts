'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface UseVoiceRecorderOptions {
  onTranscription?: (text: string) => void;
  onRecordingComplete?: (recording: any) => void;
  maxDuration?: number; // Maximum recording duration in seconds
}

interface TranscriptionResult {
  text: string;
  duration: number;
  language: string;
}

export function useVoiceRecorder({
  onTranscription,
  onRecordingComplete,
  maxDuration = 300, // 5 minutes default
}: UseVoiceRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(1000); // Capture in 1-second chunks
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone');
    }
  }, [maxDuration]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
  }, [maxDuration]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      toast.success('Recording stopped');
    }
  }, []);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setAudioBlob(null);
    chunksRef.current = [];
  }, []);

  // Upload and transcribe
  const uploadAndTranscribe = useCallback(
    async (projectId?: string) => {
      if (!audioBlob) {
        toast.error('No recording to upload');
        return null;
      }

      setIsProcessing(true);

      try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        if (projectId) {
          formData.append('projectId', projectId);
        }

        const recording = await api.uploadVoiceRecording(formData);
        
        onRecordingComplete?.(recording);
        toast.success('Recording uploaded for processing');

        // Poll for transcription
        const pollForTranscription = async () => {
          const updated = await api.getVoiceRecording(recording.id);
          
          if (updated.status === 'COMPLETED' && updated.transcription) {
            setTranscription(updated.transcription);
            onTranscription?.(updated.transcription);
            return updated;
          }
          
          if (updated.status === 'FAILED') {
            throw new Error('Transcription failed');
          }
          
          // Continue polling
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return pollForTranscription();
        };

        const result = await pollForTranscription();
        setIsProcessing(false);
        return result;
      } catch (error) {
        console.error('Error uploading recording:', error);
        toast.error('Failed to process recording');
        setIsProcessing(false);
        return null;
      }
    },
    [audioBlob, onRecordingComplete, onTranscription]
  );

  // Direct transcribe (without saving)
  const transcribeDirectly = useCallback(async () => {
    if (!audioBlob) {
      toast.error('No recording to transcribe');
      return null;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      const result: TranscriptionResult = await api.transcribeAudio(formData);
      
      setTranscription(result.text);
      onTranscription?.(result.text);
      setIsProcessing(false);
      
      return result;
    } catch (error) {
      console.error('Error transcribing:', error);
      toast.error('Failed to transcribe recording');
      setIsProcessing(false);
      return null;
    }
  }, [audioBlob, onTranscription]);

  // Generate slides from transcription
  const generateSlides = useCallback(
    async (
      recordingId: string,
      options?: { tone?: string; audience?: string; length?: number }
    ) => {
      setIsProcessing(true);

      try {
        const result = await api.generateFromVoice(recordingId, options);
        setIsProcessing(false);
        toast.success('Slides generated successfully');
        return result;
      } catch (error) {
        console.error('Error generating slides:', error);
        toast.error('Failed to generate slides');
        setIsProcessing(false);
        return null;
      }
    },
    []
  );

  // Format duration for display
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording,
    isPaused,
    isProcessing,
    duration,
    formattedDuration: formatDuration(duration),
    audioBlob,
    transcription,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    uploadAndTranscribe,
    transcribeDirectly,
    generateSlides,
  };
}
