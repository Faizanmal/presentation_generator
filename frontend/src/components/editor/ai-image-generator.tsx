'use client';

import { useState } from 'react';
import type { AxiosError } from 'axios';
import {
  Wand2,
  Loader2,
  RefreshCw,
  Download,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import Image from 'next/image';

interface AIImageGeneratorProps {
  onImageGenerated: (imageUrl: string) => void;
  suggestedPrompt?: string;
  className?: string;
}

type ImageStyle = 'realistic' | 'illustration' | 'abstract' | 'minimalist' | '3d-render' | 'watercolor';
type ImageSize = '1024x1024' | '1792x1024' | '1024x1792';

const STYLE_PRESETS: { id: ImageStyle; name: string; description: string }[] = [
  { id: 'realistic', name: 'Realistic', description: 'Photo-realistic images' },
  { id: 'illustration', name: 'Illustration', description: 'Digital art style' },
  { id: 'abstract', name: 'Abstract', description: 'Modern abstract art' },
  { id: 'minimalist', name: 'Minimalist', description: 'Clean, simple design' },
  { id: '3d-render', name: '3D Render', description: '3D rendered graphics' },
  { id: 'watercolor', name: 'Watercolor', description: 'Watercolor painting style' },
];

const SIZE_OPTIONS: { id: ImageSize; name: string; aspect: string }[] = [
  { id: '1024x1024', name: 'Square', aspect: '1:1' },
  { id: '1792x1024', name: 'Landscape', aspect: '16:9' },
  { id: '1024x1792', name: 'Portrait', aspect: '9:16' },
];

export function AIImageGenerator({
  onImageGenerated,
  suggestedPrompt = '',
  className,
}: AIImageGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState(suggestedPrompt);
  const [style, setStyle] = useState<ImageStyle>('realistic');
  const [size, setSize] = useState<ImageSize>('1792x1024');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildEnhancedPrompt = () => {
    let enhancedPrompt = prompt;

    // Add style modifiers
    switch (style) {
      case 'realistic':
        enhancedPrompt += ', professional photography, high quality, detailed';
        break;
      case 'illustration':
        enhancedPrompt += ', digital illustration, vibrant colors, modern design';
        break;
      case 'abstract':
        enhancedPrompt += ', abstract art, modern, artistic, creative';
        break;
      case 'minimalist':
        enhancedPrompt += ', minimalist design, clean, simple, elegant';
        break;
      case '3d-render':
        enhancedPrompt += ', 3D render, CGI, high quality, professional';
        break;
      case 'watercolor':
        enhancedPrompt += ', watercolor painting, artistic, soft colors';
        break;
    }

    return enhancedPrompt;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {return;}

    setIsGenerating(true);
    setError(null);

    try {
      const enhancedPrompt = buildEnhancedPrompt();

      const response = await api.generateImage(enhancedPrompt, {
        size,
        style,
      });

      setGeneratedImage(response.data.imageUrl);
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      setError(error.response?.data?.message || 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseImage = () => {
    if (generatedImage) {
      onImageGenerated(generatedImage);
      setIsOpen(false);
      resetState();
    }
  };

  const resetState = () => {
    setPrompt(suggestedPrompt);
    setGeneratedImage(null);
    setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {resetState();}
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className={cn('gap-2', className)}>
          <Sparkles className="h-4 w-4" />
          AI Image
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-150">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-500" />
            AI Image Generator
          </DialogTitle>
          <DialogDescription>
            Describe the image you want to create and our AI will generate it for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Image Description</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., A futuristic city skyline at sunset with flying cars..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Style Selection */}
          <div className="space-y-2">
            <Label>Style</Label>
            <div className="grid grid-cols-3 gap-2">
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={cn(
                    'p-2 rounded-lg border-2 text-left transition-colors',
                    style === preset.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-slate-200 hover:border-slate-300',
                  )}
                  onClick={() => setStyle(preset.id)}
                >
                  <p className="text-sm font-medium">{preset.name}</p>
                  <p className="text-xs text-slate-500">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div className="space-y-2">
            <Label>Size</Label>
            <Select value={size} onValueChange={(v) => setSize(v as ImageSize)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name} ({option.aspect})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generated Image Preview */}
          {generatedImage && (
            <div className="space-y-2">
              <Label>Generated Image</Label>
              <div className="relative rounded-lg overflow-hidden border">
                <Image
                  src={generatedImage}
                  alt="Generated"
                  className="w-full h-auto"
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => window.open(generatedImage, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {generatedImage ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setGeneratedImage(null);
                  handleGenerate();
                }}
                disabled={isGenerating}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
              <Button onClick={handleUseImage}>
                <Check className="h-4 w-4 mr-2" />
                Use This Image
              </Button>
            </>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Image
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Quick generate button for inline use
export function QuickAIImage({
  slideContext,
  onImageGenerated,
  className,
}: {
  slideContext?: string;
  onImageGenerated: (imageUrl: string) => void;
  className?: string;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleQuickGenerate = async () => {
    if (!slideContext) {return;}

    setIsGenerating(true);
    try {
      const response = await api.generateImage(`Professional presentation image for: ${slideContext}`, {
        size: '1792x1024',
        style: 'minimalist',
      });

      onImageGenerated(response.data.imageUrl);
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('gap-1', className)}
      onClick={handleQuickGenerate}
      disabled={isGenerating || !slideContext}
    >
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      AI Image
    </Button>
  );
}

export default AIImageGenerator;
