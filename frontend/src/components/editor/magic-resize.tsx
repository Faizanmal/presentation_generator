'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Maximize2,
  Monitor,
  Smartphone,
  Tablet,
  Square,
  FileImage,
  Loader2,
  Check,
  RefreshCw,
  AlertCircle,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from '@/components/ui/card';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FormatPreset {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  aspectRatio: string;
  icon: React.ReactNode;
  category: 'presentation' | 'social' | 'print' | 'mobile';
  popular?: boolean;
}

interface MagicResizeProps {
  projectId: string;
  currentFormat: {
    width: number;
    height: number;
  };
  onResize: (format: { width: number; height: number }) => void;
}

const formatPresets: FormatPreset[] = [
  // Presentation formats
  {
    id: 'widescreen',
    name: 'Widescreen (16:9)',
    description: 'Standard modern presentation',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    icon: <Monitor className="h-5 w-5" />,
    category: 'presentation',
    popular: true,
  },
  {
    id: 'standard',
    name: 'Standard (4:3)',
    description: 'Classic presentation format',
    width: 1024,
    height: 768,
    aspectRatio: '4:3',
    icon: <Monitor className="h-5 w-5" />,
    category: 'presentation',
  },
  {
    id: 'ultra-wide',
    name: 'Ultra Wide (21:9)',
    description: 'Cinema-style presentations',
    width: 2560,
    height: 1080,
    aspectRatio: '21:9',
    icon: <Monitor className="h-5 w-5" />,
    category: 'presentation',
  },
  {
    id: 'a4',
    name: 'A4 Document',
    description: 'Standard document size',
    width: 794,
    height: 1123,
    aspectRatio: '1:√2',
    icon: <FileImage className="h-5 w-5" />,
    category: 'print',
  },
  {
    id: 'letter',
    name: 'US Letter',
    description: 'US standard paper size',
    width: 816,
    height: 1056,
    aspectRatio: '8.5:11',
    icon: <FileImage className="h-5 w-5" />,
    category: 'print',
  },
  // Social media formats
  {
    id: 'instagram-post',
    name: 'Instagram Post',
    description: 'Square format for feed',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    icon: <Square className="h-5 w-5" />,
    category: 'social',
    popular: true,
  },
  {
    id: 'instagram-story',
    name: 'Instagram Story',
    description: 'Vertical story format',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    icon: <Smartphone className="h-5 w-5" />,
    category: 'social',
    popular: true,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'LinkedIn feed post',
    width: 1200,
    height: 628,
    aspectRatio: '1.91:1',
    icon: <Monitor className="h-5 w-5" />,
    category: 'social',
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    description: 'Twitter post image',
    width: 1200,
    height: 675,
    aspectRatio: '16:9',
    icon: <Monitor className="h-5 w-5" />,
    category: 'social',
  },
  {
    id: 'facebook',
    name: 'Facebook Post',
    description: 'Facebook feed image',
    width: 1200,
    height: 630,
    aspectRatio: '1.91:1',
    icon: <Monitor className="h-5 w-5" />,
    category: 'social',
  },
  {
    id: 'youtube-thumbnail',
    name: 'YouTube Thumbnail',
    description: 'Video thumbnail',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    icon: <Monitor className="h-5 w-5" />,
    category: 'social',
  },
  // Mobile formats
  {
    id: 'iphone',
    name: 'iPhone',
    description: 'iPhone screen size',
    width: 1170,
    height: 2532,
    aspectRatio: '9:19.5',
    icon: <Smartphone className="h-5 w-5" />,
    category: 'mobile',
  },
  {
    id: 'ipad',
    name: 'iPad',
    description: 'iPad screen size',
    width: 2048,
    height: 2732,
    aspectRatio: '3:4',
    icon: <Tablet className="h-5 w-5" />,
    category: 'mobile',
  },
];

export function MagicResize({ currentFormat, onResize }: MagicResizeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<FormatPreset | null>(null);
  const [resizeProgress, setResizeProgress] = useState(0);

  const resizeMutation = useMutation({
    mutationFn: async (format: FormatPreset) => {
      setResizeProgress(0);

      // Simulate AI-powered resize with progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((r) => setTimeout(r, 200));
        setResizeProgress(i);
      }

      return { success: true, format };
    },
    onSuccess: (data) => {
      onResize({
        width: data.format.width,
        height: data.format.height,
      });
      setIsOpen(false);
      toast.success(`Resized to ${data.format.name}`);
    },
  });

  const handleResize = () => {
    if (!selectedFormat) {return;}
    resizeMutation.mutate(selectedFormat);
  };

  const getCurrentAspectRatio = () => {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(currentFormat.width, currentFormat.height);
    return `${currentFormat.width / divisor}:${currentFormat.height / divisor}`;
  };



  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Maximize2 className="h-4 w-4 mr-2" />
          Magic Resize
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-500" />
            Magic Resize
          </DialogTitle>
          <DialogDescription>
            AI-powered resize adapts your content to any format while maintaining
            design quality.
          </DialogDescription>
        </DialogHeader>

        {resizeMutation.isPending ? (
          <div className="py-12 space-y-6">
            <div className="text-center">
              <Wand2 className="h-12 w-12 text-purple-500 mx-auto mb-4 animate-pulse" />
              <h3 className="font-medium mb-2">Resizing your presentation...</h3>
              <p className="text-sm text-slate-500">
                Our AI is adapting layouts and repositioning elements
              </p>
            </div>
            <Progress value={resizeProgress} className="max-w-xs mx-auto" />
            <div className="text-center text-sm text-slate-500">
              {resizeProgress < 30 && 'Analyzing slide layouts...'}
              {resizeProgress >= 30 && resizeProgress < 60 && 'Repositioning elements...'}
              {resizeProgress >= 60 && resizeProgress < 90 && 'Optimizing for new format...'}
              {resizeProgress >= 90 && 'Finishing up...'}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg mb-4">
              <div className="flex-1">
                <span className="text-sm text-slate-500">Current Format</span>
                <p className="font-medium">
                  {currentFormat.width} × {currentFormat.height}
                </p>
                <span className="text-xs text-slate-400">
                  Aspect Ratio: {getCurrentAspectRatio()}
                </span>
              </div>
              {selectedFormat && (
                <>
                  <RefreshCw className="h-5 w-5 text-slate-400" />
                  <div className="flex-1">
                    <span className="text-sm text-slate-500">New Format</span>
                    <p className="font-medium">
                      {selectedFormat.width} × {selectedFormat.height}
                    </p>
                    <span className="text-xs text-slate-400">
                      {selectedFormat.name}
                    </span>
                  </div>
                </>
              )}
            </div>

            <Tabs defaultValue="presentation">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="presentation">Presentation</TabsTrigger>
                <TabsTrigger value="social">Social</TabsTrigger>
                <TabsTrigger value="print">Print</TabsTrigger>
                <TabsTrigger value="mobile">Mobile</TabsTrigger>
              </TabsList>

              {['presentation', 'social', 'print', 'mobile'].map((category) => (
                <TabsContent key={category} value={category}>
                  <ScrollArea className="h-[300px]">
                    <div className="grid grid-cols-2 gap-3 p-1">
                      {formatPresets
                        .filter((f) => f.category === category)
                        .map((format) => (
                          <button
                            key={format.id}
                            onClick={() => setSelectedFormat(format)}
                            className={cn(
                              'flex items-start gap-3 p-4 rounded-lg border text-left transition-all',
                              selectedFormat?.id === format.id
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                : 'border-slate-200 hover:border-slate-300'
                            )}
                          >
                            <div
                              className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                selectedFormat?.id === format.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {format.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{format.name}</span>
                                {format.popular && (
                                  <Badge variant="secondary" className="text-xs">
                                    Popular
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-500">
                                {format.description}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {format.width} × {format.height} ({format.aspectRatio})
                              </p>
                            </div>
                            {selectedFormat?.id === format.id && (
                              <Check className="h-5 w-5 text-primary" />
                            )}
                          </button>
                        ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>

            {selectedFormat && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <strong>Note:</strong> Magic Resize will create a copy of your
                  presentation in the new format. Original slides remain unchanged.
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleResize}
            disabled={!selectedFormat || resizeMutation.isPending}
          >
            {resizeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 mr-2" />
            )}
            Resize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
