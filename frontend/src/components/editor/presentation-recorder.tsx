'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  Circle,
  Square,
  Pause,
  Play,
  Download,
  Settings,
  Camera,
  Trash2,
  Share2,
  Clock,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Maximize2,
  PictureInPicture,
  Volume2,
} from 'lucide-react';

interface RecordingSettings {
  includeWebcam: boolean;
  includeAudio: boolean;
  includeScreen: boolean;
  webcamPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  webcamSize: 'small' | 'medium' | 'large';
  quality: 'standard' | 'high' | 'ultra';
  format: 'webm' | 'mp4';
  countdown: number;
}

interface Recording {
  id: string;
  name: string;
  duration: number;
  size: number;
  createdAt: Date;
  blob: Blob;
  thumbnailUrl?: string;
}

type RecordingState = 'idle' | 'countdown' | 'recording' | 'paused' | 'processing' | 'complete';

export function PresentationRecorder() {
  const [isOpen, setIsOpen] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [countdown, setCountdown] = useState(0);
  const [duration, setDuration] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentRecording, setCurrentRecording] = useState<Recording | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const [settings, setSettings] = useState<RecordingSettings>({
    includeWebcam: true,
    includeAudio: true,
    includeScreen: true,
    webcamPosition: 'bottom-right',
    webcamSize: 'medium',
    quality: 'high',
    format: 'webm',
    countdown: 3,
  });

  const [devices, setDevices] = useState<{
    cameras: MediaDeviceInfo[];
    microphones: MediaDeviceInfo[];
  }>({ cameras: [], microphones: [] });

  const [selectedDevices, setSelectedDevices] = useState({
    camera: '',
    microphone: '',
  });

  const webcamRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const stopAllStreams = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    webcamStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const processRecording = useCallback(() => {
    const blob = new Blob(chunksRef.current, {
      type: settings.format === 'webm' ? 'video/webm' : 'video/mp4',
    });

    const recording: Recording = {
      id: `rec_${Date.now()}`,
      name: `Recording ${recordings.length + 1}`,
      duration,
      size: blob.size,
      createdAt: new Date(),
      blob,
    };

    // Generate thumbnail
    const video = document.createElement('video');
    video.src = URL.createObjectURL(blob);
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, 160, 90);
      recording.thumbnailUrl = canvas.toDataURL();
      setRecordings((prev) => [...prev, recording]);
      setCurrentRecording(recording);
      setRecordingState('complete');
    };
  }, [duration, recordings.length, settings.format]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      stopAllStreams();
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingState('processing');
    }
  }, [stopAllStreams]);

  const startRecording = useCallback(async () => {
    try {
      // Start countdown
      setRecordingState('countdown');
      setCountdown(settings.countdown);

      for (let i = settings.countdown; i > 0; i--) {
        setCountdown(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Get screen stream
      const streams: MediaStream[] = [];

      if (settings.includeScreen) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: settings.quality === 'ultra' ? 1920 : settings.quality === 'high' ? 1280 : 854,
            height: settings.quality === 'ultra' ? 1080 : settings.quality === 'high' ? 720 : 480,
            frameRate: 30,
          },
          audio: settings.includeAudio,
        });
        streams.push(screenStream);
      }

      // Get webcam stream
      if (settings.includeWebcam && selectedDevices.camera) {
        const webcamStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: selectedDevices.camera },
          audio: false,
        });
        streams.push(webcamStream);
      }

      // Get audio stream
      if (settings.includeAudio && selectedDevices.microphone) {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: selectedDevices.microphone },
        });
        streams.push(audioStream);
      }

      // Combine streams
      const tracks = streams.flatMap((s) => s.getTracks());
      const combinedStream = new MediaStream(tracks);
      streamRef.current = combinedStream;

      // Set up MediaRecorder
      const mimeType = settings.format === 'webm' ? 'video/webm;codecs=vp9' : 'video/mp4';
      mediaRecorderRef.current = new MediaRecorder(combinedStream, { mimeType });

      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        processRecording();
      };

      // Start recording
      mediaRecorderRef.current.start(1000);
      setRecordingState('recording');
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Handle screen share stop
      if (settings.includeScreen) {
        const screenTrack = streams[0]?.getVideoTracks()[0];
        screenTrack?.addEventListener('ended', () => {
          stopRecording();
        });
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingState('idle');
    }
  }, [settings, selectedDevices, processRecording, stopRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  }, []);

  // Load available devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Request permission first
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const cameras = deviceList.filter((d) => d.kind === 'videoinput');
        const microphones = deviceList.filter((d) => d.kind === 'audioinput');

        setDevices({ cameras, microphones });

        if (cameras.length > 0) {
          setSelectedDevices((prev) => ({ ...prev, camera: cameras[0].deviceId }));
        }
        if (microphones.length > 0) {
          setSelectedDevices((prev) => ({ ...prev, microphone: microphones[0].deviceId }));
        }
      } catch (error) {
        console.error('Failed to load devices:', error);
      }
    };

    if (isOpen) {
      loadDevices();
    }

    return () => {
      stopAllStreams();
    };
  }, [isOpen, stopAllStreams]);

  // Start webcam preview
  useEffect(() => {
    const startWebcamPreview = async () => {
      if (!settings.includeWebcam || !selectedDevices.camera || recordingState !== 'idle') {
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: selectedDevices.camera },
          audio: false,
        });

        webcamStreamRef.current = stream;
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Failed to start webcam preview:', error);
      }
    };

    startWebcamPreview();

    return () => {
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [settings.includeWebcam, selectedDevices.camera, recordingState]);

  // Audio level monitoring
  useEffect(() => {
    if (!settings.includeAudio || !selectedDevices.microphone) return;

    let animationFrame: number;

    const startAudioMonitoring = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: selectedDevices.microphone },
        });

        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

        const updateLevel = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(Math.min(100, (average / 128) * 100));
          }
          animationFrame = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (error) {
        console.error('Failed to start audio monitoring:', error);
      }
    };

    startAudioMonitoring();

    return () => {
      cancelAnimationFrame(animationFrame);
      audioContextRef.current?.close();
    };
  }, [settings.includeAudio, selectedDevices.microphone]);

  const downloadRecording = useCallback((recording: Recording) => {
    const url = URL.createObjectURL(recording.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.name}.${settings.format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [settings.format]);

  const deleteRecording = useCallback((id: string) => {
    setRecordings((prev) => prev.filter((r) => r.id !== id));
    if (currentRecording?.id === id) {
      setCurrentRecording(null);
    }
  }, [currentRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getWebcamPositionClass = () => {
    const positions = {
      'top-left': 'top-4 left-4',
      'top-right': 'top-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'bottom-right': 'bottom-4 right-4',
    };
    return positions[settings.webcamPosition];
  };

  const getWebcamSizeClass = () => {
    const sizes = {
      small: 'w-24 h-18',
      medium: 'w-40 h-30',
      large: 'w-56 h-42',
    };
    return sizes[settings.webcamSize];
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Video className="h-4 w-4" />
          Record Presentation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Presentation Recorder
          </DialogTitle>
          <DialogDescription>
            Record your presentation with screen, webcam, and audio
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="record" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="record">Record</TabsTrigger>
            <TabsTrigger value="recordings">
              Recordings ({recordings.length})
            </TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="record" className="space-y-4">
            {/* Preview Area */}
            <div className="relative bg-slate-900 rounded-lg aspect-video overflow-hidden">
              {recordingState === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <Monitor className="h-16 w-16 mb-4 opacity-50" />
                  <p className="text-lg">Ready to record</p>
                  <p className="text-sm text-slate-400 mt-2">
                    Click Start Recording to begin
                  </p>
                </div>
              )}

              {recordingState === 'countdown' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-8xl font-bold text-white animate-pulse">
                    {countdown}
                  </div>
                </div>
              )}

              {(recordingState === 'recording' || recordingState === 'paused') && (
                <>
                  <video
                    ref={previewRef}
                    autoPlay
                    muted
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <Badge
                      variant={recordingState === 'recording' ? 'destructive' : 'secondary'}
                      className="gap-1"
                    >
                      {recordingState === 'recording' ? (
                        <>
                          <Circle className="h-2 w-2 fill-current animate-pulse" />
                          REC
                        </>
                      ) : (
                        <>
                          <Pause className="h-3 w-3" />
                          PAUSED
                        </>
                      )}
                    </Badge>
                    <Badge variant="outline" className="text-white border-white/50">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDuration(duration)}
                    </Badge>
                  </div>
                </>
              )}

              {recordingState === 'processing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4" />
                  <p>Processing recording...</p>
                </div>
              )}

              {recordingState === 'complete' && currentRecording && (
                <video
                  src={URL.createObjectURL(currentRecording.blob)}
                  controls
                  className="w-full h-full"
                />
              )}

              {/* Webcam Preview */}
              {settings.includeWebcam && recordingState === 'idle' && (
                <div
                  className={`absolute ${getWebcamPositionClass()} ${getWebcamSizeClass()} rounded-lg overflow-hidden border-2 border-white shadow-lg`}
                >
                  <video
                    ref={webcamRef}
                    autoPlay
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* Audio Level */}
            {settings.includeAudio && recordingState === 'idle' && (
              <div className="flex items-center gap-3">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <Progress value={audioLevel} className="flex-1 h-2" />
                <span className="text-sm text-muted-foreground w-12">
                  {Math.round(audioLevel)}%
                </span>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              {recordingState === 'idle' && (
                <Button size="lg" onClick={startRecording} className="gap-2">
                  <Circle className="h-4 w-4 fill-current" />
                  Start Recording
                </Button>
              )}

              {recordingState === 'recording' && (
                <>
                  <Button variant="outline" size="lg" onClick={pauseRecording}>
                    <Pause className="h-5 w-5" />
                  </Button>
                  <Button variant="destructive" size="lg" onClick={stopRecording}>
                    <Square className="h-5 w-5" />
                  </Button>
                </>
              )}

              {recordingState === 'paused' && (
                <>
                  <Button size="lg" onClick={resumeRecording}>
                    <Play className="h-5 w-5" />
                  </Button>
                  <Button variant="destructive" size="lg" onClick={stopRecording}>
                    <Square className="h-5 w-5" />
                  </Button>
                </>
              )}

              {recordingState === 'complete' && currentRecording && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRecordingState('idle');
                      setCurrentRecording(null);
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Record Again
                  </Button>
                  <Button onClick={() => downloadRecording(currentRecording)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="secondary">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </>
              )}
            </div>

            {/* Quick Settings */}
            {recordingState === 'idle' && (
              <div className="flex items-center justify-center gap-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    id="quick-webcam"
                    checked={settings.includeWebcam}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, includeWebcam: checked }))
                    }
                  />
                  <Label htmlFor="quick-webcam" className="flex items-center gap-1">
                    {settings.includeWebcam ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    Webcam
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="quick-audio"
                    checked={settings.includeAudio}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, includeAudio: checked }))
                    }
                  />
                  <Label htmlFor="quick-audio" className="flex items-center gap-1">
                    {settings.includeAudio ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    Audio
                  </Label>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recordings">
            <ScrollArea className="h-[400px]">
              {recordings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Video className="h-12 w-12 mb-4" />
                  <p>No recordings yet</p>
                  <p className="text-sm">Start recording to see your videos here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recordings.map((recording) => (
                    <Card key={recording.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {recording.thumbnailUrl ? (
                            <img
                              src={recording.thumbnailUrl}
                              alt=""
                              className="w-32 h-18 rounded object-cover"
                            />
                          ) : (
                            <div className="w-32 h-18 bg-slate-200 rounded flex items-center justify-center">
                              <Video className="h-6 w-6 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-medium">{recording.name}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(recording.duration)}
                              </span>
                              <span>{formatFileSize(recording.size)}</span>
                              <span>
                                {recording.createdAt.toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadRecording(recording)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteRecording(recording.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            {/* Device Selection */}
            <div className="space-y-4">
              <h3 className="font-medium">Devices</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Camera</Label>
                  <Select
                    value={selectedDevices.camera}
                    onValueChange={(value) =>
                      setSelectedDevices((prev) => ({ ...prev, camera: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.cameras.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Microphone</Label>
                  <Select
                    value={selectedDevices.microphone}
                    onValueChange={(value) =>
                      setSelectedDevices((prev) => ({ ...prev, microphone: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select microphone" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.microphones.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Webcam Settings */}
            <div className="space-y-4">
              <h3 className="font-medium">Webcam Overlay</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select
                    value={settings.webcamPosition}
                    onValueChange={(value: RecordingSettings['webcamPosition']) =>
                      setSettings((prev) => ({ ...prev, webcamPosition: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top-left">Top Left</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Select
                    value={settings.webcamSize}
                    onValueChange={(value: RecordingSettings['webcamSize']) =>
                      setSettings((prev) => ({ ...prev, webcamSize: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Quality Settings */}
            <div className="space-y-4">
              <h3 className="font-medium">Quality</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Video Quality</Label>
                  <Select
                    value={settings.quality}
                    onValueChange={(value: RecordingSettings['quality']) =>
                      setSettings((prev) => ({ ...prev, quality: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (480p)</SelectItem>
                      <SelectItem value="high">High (720p)</SelectItem>
                      <SelectItem value="ultra">Ultra (1080p)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select
                    value={settings.format}
                    onValueChange={(value: RecordingSettings['format']) =>
                      setSettings((prev) => ({ ...prev, format: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webm">WebM</SelectItem>
                      <SelectItem value="mp4">MP4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Countdown */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Countdown before recording</Label>
                <span className="text-sm text-muted-foreground">
                  {settings.countdown} seconds
                </span>
              </div>
              <Slider
                value={[settings.countdown]}
                onValueChange={([value]) =>
                  setSettings((prev) => ({ ...prev, countdown: value }))
                }
                min={0}
                max={10}
                step={1}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
