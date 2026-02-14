'use client';

import { useState, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Supported embed types
type EmbedType = 'youtube' | 'vimeo' | 'loom' | 'figma' | 'miro' | 'codepen' | 'custom';

interface EmbedBlockProps {
  data?: {
    type: EmbedType;
    url: string;
    title?: string;
    autoplay?: boolean;
    muted?: boolean;
  };
  onChange?: (data: EmbedBlockProps['data']) => void;
  isEditable?: boolean;
  className?: string;
}

const EMBED_CONFIGS: Record<EmbedType, {
  name: string;
  pattern: RegExp;
  embedUrl: (match: RegExpMatchArray) => string;
  icon: string;
}> = {
  youtube: {
    name: 'YouTube',
    pattern: /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    embedUrl: (match) => `https://www.youtube.com/embed/${match[1]}`,
    icon: '🎬',
  },
  vimeo: {
    name: 'Vimeo',
    pattern: /vimeo\.com\/(?:video\/)?(\d+)/,
    embedUrl: (match) => `https://player.vimeo.com/video/${match[1]}`,
    icon: '🎥',
  },
  loom: {
    name: 'Loom',
    pattern: /loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/,
    embedUrl: (match) => `https://www.loom.com/embed/${match[1]}`,
    icon: '📹',
  },
  figma: {
    name: 'Figma',
    pattern: /figma\.com\/(?:file|proto)\/([a-zA-Z0-9]+)/,
    embedUrl: (match) => `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(match[0])}`,
    icon: '🎨',
  },
  miro: {
    name: 'Miro',
    pattern: /miro\.com\/app\/board\/([a-zA-Z0-9=]+)/,
    embedUrl: (match) => `https://miro.com/app/live-embed/${match[1]}/?autoplay=yep`,
    icon: '📋',
  },
  codepen: {
    name: 'CodePen',
    pattern: /codepen\.io\/([a-zA-Z0-9_-]+)\/pen\/([a-zA-Z0-9]+)/,
    embedUrl: (match) => `https://codepen.io/${match[1]}/embed/${match[2]}?default-tab=result`,
    icon: '💻',
  },
  custom: {
    name: 'Custom',
    pattern: /.*/,
    embedUrl: (match) => match[0],
    icon: '🔗',
  },
};

function detectEmbedType(url: string): { type: EmbedType; embedUrl: string } | null {
  for (const [type, config] of Object.entries(EMBED_CONFIGS)) {
    if (type === 'custom') {continue;}
    const match = url.match(config.pattern);
    if (match) {
      return {
        type: type as EmbedType,
        embedUrl: config.embedUrl(match),
      };
    }
  }
  return { type: 'custom', embedUrl: url };
}

export function EmbedBlock({
  data = { type: 'youtube', url: '' },
  onChange,
  isEditable = true,
  className,
}: EmbedBlockProps) {
  const [embedType, setEmbedType] = useState<EmbedType>(data.type || 'youtube');
  const [url, setUrl] = useState(data.url || '');
  const [title, setTitle] = useState(data.title || '');
  const [embedUrl, setEmbedUrl] = useState('');
  const [isPlaying, ] = useState(data.autoplay || false);
  const [isMuted, ] = useState(data.muted || true);
  const [showDialog, setShowDialog] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);



  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    const detected = detectEmbedType(newUrl);
    if (detected) {
      setEmbedType(detected.type);
      setEmbedUrl(detected.embedUrl);
      onChange?.({ type: detected.type, url: newUrl, title });
    }
  };

  const handleSave = () => {
    onChange?.({ type: embedType, url, title, autoplay: isPlaying, muted: isMuted });
    setShowDialog(false);
  };

  // Render empty state if no URL
  if (!url || !embedUrl) {
    if (!isEditable) {
      return (
        <div className={cn('rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center', className)}>
          <p className="text-slate-500">No embed configured</p>
        </div>
      );
    }

    return (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <div
            className={cn(
              'rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors',
              className,
            )}
          >
            <div className="text-4xl mb-2">🔗</div>
            <p className="text-slate-600 font-medium">Add Embed</p>
            <p className="text-slate-400 text-sm mt-1">
              YouTube, Vimeo, Figma, Miro, and more
            </p>
          </div>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Embed</DialogTitle>
          </DialogHeader>
          <EmbedForm
            url={url}
            title={title}
            embedType={embedType}
            onUrlChange={handleUrlChange}
            onTitleChange={setTitle}
            onTypeChange={setEmbedType}
            onSave={handleSave}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className={cn('relative rounded-lg overflow-hidden', className)}>
      {/* Title */}
      {title && (
        <div className="bg-slate-100 px-4 py-2 border-b flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">{title}</span>
          <span className="text-xs text-slate-400">
            {EMBED_CONFIGS[embedType]?.icon} {EMBED_CONFIGS[embedType]?.name}
          </span>
        </div>
      )}

      {/* Embed iframe */}
      <div className="relative aspect-video bg-black">
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={title || 'Embedded content'}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Controls (edit mode) */}
      {isEditable && (
        <div className="absolute top-2 right-2 flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white"
            onClick={() => window.open(url, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2 bg-black/50 hover:bg-black/70 text-white"
              >
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Embed</DialogTitle>
              </DialogHeader>
              <EmbedForm
                url={url}
                title={title}
                embedType={embedType}
                onUrlChange={handleUrlChange}
                onTitleChange={setTitle}
                onTypeChange={setEmbedType}
                onSave={handleSave}
              />
            </DialogContent>
          </Dialog>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-8 p-0 bg-red-500/80 hover:bg-red-600 text-white"
            onClick={() => {
              setUrl('');
              setEmbedUrl('');
              onChange?.({ type: embedType, url: '', title: '' });
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function EmbedForm({
  url,
  title,
  embedType,
  onUrlChange,
  onTitleChange,
  onSave,
}: {
  url: string;
  title: string;
  embedType: EmbedType;
  onUrlChange: (url: string) => void;
  onTitleChange: (title: string) => void;
  onTypeChange: (type: EmbedType) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>URL</Label>
        <Input
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
        />
        <p className="text-xs text-slate-500 mt-1">
          Paste a link from YouTube, Vimeo, Figma, Miro, or any embed URL
        </p>
      </div>

      <div>
        <Label>Title (optional)</Label>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Video title"
        />
      </div>

      {url && (
        <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-lg">
          <span className="text-xl">{EMBED_CONFIGS[embedType]?.icon}</span>
          <span className="text-sm text-slate-600">
            Detected: {EMBED_CONFIGS[embedType]?.name}
          </span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onUrlChange('')}>
          Clear
        </Button>
        <Button onClick={onSave} disabled={!url}>
          Save Embed
        </Button>
      </div>
    </div>
  );
}

export default EmbedBlock;
