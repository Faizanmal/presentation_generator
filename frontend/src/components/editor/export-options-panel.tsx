'use client';

import { useState } from 'react';
import {
  Download,
  FileJson,
  FileText,
  FileImage,
  Presentation,
  Video,
  Loader2,
  Check,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface ExportOptionsPanelProps {
  projectId: string;
  projectTitle: string;
  className?: string;
}

type ExportFormat = 'pdf' | 'pptx' | 'html' | 'json' | 'video';

interface ExportOption {
  id: ExportFormat;
  name: string;
  description: string;
  icon: React.ReactNode;
  isPremium: boolean;
  fileExtension: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'pdf',
    name: 'PDF Document',
    description: 'High-quality PDF for sharing and printing',
    icon: <FileText className="h-5 w-5" />,
    isPremium: false,
    fileExtension: 'pdf',
  },
  {
    id: 'pptx',
    name: 'PowerPoint',
    description: 'Editable PPTX file for Microsoft PowerPoint',
    icon: <Presentation className="h-5 w-5" />,
    isPremium: true,
    fileExtension: 'pptx',
  },
  {
    id: 'html',
    name: 'HTML Website',
    description: 'Self-contained HTML file for web hosting',
    icon: <FileImage className="h-5 w-5" />,
    isPremium: false,
    fileExtension: 'html',
  },
  {
    id: 'json',
    name: 'JSON Data',
    description: 'Raw presentation data for developers',
    icon: <FileJson className="h-5 w-5" />,
    isPremium: false,
    fileExtension: 'json',
  },
  {
    id: 'video',
    name: 'Video',
    description: 'MP4 video with narration and transitions',
    icon: <Video className="h-5 w-5" />,
    isPremium: true,
    fileExtension: 'mp4',
  },
];

export function ExportOptionsPanel({
  projectId,
  projectTitle,
  className,
}: ExportOptionsPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Export options
  const [includeNotes, setIncludeNotes] = useState(false);
  const [includeAnimations, setIncludeAnimations] = useState(true);
  const [quality, setQuality] = useState<'standard' | 'high'>('high');
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [includeNarration, setIncludeNarration] = useState(true);

  // Video export state
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      let blob: Blob | null = null;
      let filename = `${projectTitle.replace(/[^a-z0-9]/gi, '_')}.${EXPORT_OPTIONS.find(o => o.id === selectedFormat)?.fileExtension}`;

      switch (selectedFormat) {
        case 'pdf':
          setExportProgress(30);
          const pdfResponse = await api.exportProject(projectId, 'pdf');
          blob = new Blob([pdfResponse], { type: 'application/pdf' });
          break;

        case 'pptx':
          setExportProgress(30);
          const pptxBlob = await api.exportToPptx(projectId, {
            includeNotes,
            includeAnimations,
          });
          blob = pptxBlob;
          break;

        case 'html':
          setExportProgress(30);
          const htmlResponse = await api.exportProject(projectId, 'html');
          blob = new Blob([htmlResponse], { type: 'text/html' });
          break;

        case 'json':
          setExportProgress(30);
          const jsonResponse = await api.exportProject(projectId, 'json');
          blob = new Blob([JSON.stringify(jsonResponse, null, 2)], { type: 'application/json' });
          break;

        case 'video':
          const videoResponse = await api.exportToVideo(projectId, {
            resolution: videoResolution,
            includeNarration,
          });
          setVideoJobId(videoResponse.jobId);
          setVideoStatus('processing');
          toast.info(`Video export started. Estimated time: ${Math.round(videoResponse.estimatedTime / 60)} minutes`);
          pollVideoStatus(videoResponse.jobId);
          setIsExporting(false);
          return;
      }

      setExportProgress(80);

      if (blob) {
        // Download the file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setExportProgress(100);
        toast.success(`Exported as ${filename}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Export failed');
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(0), 1000);
    }
  };

  const pollVideoStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await api.getExportJobStatus(jobId);
        setVideoStatus(status.status);
        setExportProgress(status.progress);

        if (status.status === 'completed' && status.downloadUrl) {
          clearInterval(interval);
          // Download the video
          window.open(status.downloadUrl, '_blank');
          toast.success('Video export completed!');
        } else if (status.status === 'failed') {
          clearInterval(interval);
          toast.error(status.error || 'Video export failed');
        }
      } catch (error) {
        clearInterval(interval);
      }
    }, 5000);
  };

  const selectedOption = EXPORT_OPTIONS.find(o => o.id === selectedFormat);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Export Presentation</DialogTitle>
          <DialogDescription>
            Choose a format and customize your export options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format selection */}
          <div className="grid grid-cols-2 gap-3">
            {EXPORT_OPTIONS.map((option) => (
              <Card
                key={option.id}
                className={cn(
                  'cursor-pointer transition-all hover:border-blue-400',
                  selectedFormat === option.id && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                )}
                onClick={() => setSelectedFormat(option.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        selectedFormat === option.id 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      )}>
                        {option.icon}
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{option.name}</h4>
                        <p className="text-xs text-slate-500">{option.description}</p>
                      </div>
                    </div>
                    {option.isPremium && (
                      <Badge variant="secondary" className="bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700">
                        Pro
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Advanced options toggle */}
          <button
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings className="h-4 w-4" />
            Advanced Options
          </button>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="space-y-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              {/* Common options */}
              <div className="flex items-center justify-between">
                <Label htmlFor="include-notes" className="text-sm">Include speaker notes</Label>
                <Switch
                  id="include-notes"
                  checked={includeNotes}
                  onCheckedChange={setIncludeNotes}
                />
              </div>

              {(selectedFormat === 'pptx' || selectedFormat === 'html') && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-animations" className="text-sm">Include animations</Label>
                  <Switch
                    id="include-animations"
                    checked={includeAnimations}
                    onCheckedChange={setIncludeAnimations}
                  />
                </div>
              )}

              {selectedFormat === 'pdf' && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Quality</Label>
                  <Select value={quality} onValueChange={(v) => setQuality(v as 'standard' | 'high')}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedFormat === 'video' && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Resolution</Label>
                    <Select value={videoResolution} onValueChange={(v) => setVideoResolution(v as '720p' | '1080p' | '4k')}>
                      <SelectTrigger className="w-[120px]">
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
                    <Label htmlFor="include-narration" className="text-sm">Include AI narration</Label>
                    <Switch
                      id="include-narration"
                      checked={includeNarration}
                      onCheckedChange={setIncludeNarration}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Export progress */}
          {(isExporting || videoStatus === 'processing') && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {videoStatus === 'processing' ? 'Processing video...' : 'Exporting...'}
                </span>
                <span>{Math.round(exportProgress)}%</span>
              </div>
              <Progress value={exportProgress} />
            </div>
          )}

          {/* Video job status */}
          {videoStatus === 'completed' && videoJobId && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700">
              <Check className="h-5 w-5" />
              <span>Video export completed! Check your downloads.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleExport}
            disabled={isExporting || videoStatus === 'processing'}
            className="w-full"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export as {selectedOption?.name}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
