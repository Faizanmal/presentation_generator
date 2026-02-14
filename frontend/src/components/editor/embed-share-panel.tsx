'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// import { Slider } from '@/components/ui/slider';
import {
  Share2,
  Code,
  Mail,
  Copy,
  Check,
  Twitter,
  Linkedin,
  Facebook,
  QrCode,
  Eye,
  Lock,
  Globe,
  Users,
  Clock,
  ExternalLink,
  Download,
} from 'lucide-react';

interface ShareSettings {
  isPublic: boolean;
  requirePassword: boolean;
  password: string;
  allowDownload: boolean;
  allowComments: boolean;
  showAuthor: boolean;
  expiresAt: Date | null;
  accessCount: number;
  maxViews: number | null;
}

interface EmbedSettings {
  width: number;
  height: number;
  autoplay: boolean;
  loop: boolean;
  showControls: boolean;
  showNavigation: boolean;
  responsive: boolean;
  theme: 'light' | 'dark' | 'auto';
  startSlide: number;
}

interface EmbedSharePanelProps {
  presentationId: string;
  presentationTitle: string;
  onShare?: () => void;
}

export function EmbedSharePanel({
  presentationId,
  presentationTitle,
}: EmbedSharePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    isPublic: true,
    requirePassword: false,
    password: '',
    allowDownload: true,
    allowComments: true,
    showAuthor: true,
    expiresAt: null,
    accessCount: 0,
    maxViews: null,
  });

  const [embedSettings, setEmbedSettings] = useState<EmbedSettings>({
    width: 800,
    height: 600,
    autoplay: false,
    loop: false,
    showControls: true,
    showNavigation: true,
    responsive: true,
    theme: 'auto',
    startSlide: 1,
  });

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${baseUrl}/view/${presentationId}`;
  const embedUrl = `${baseUrl}/embed/${presentationId}`;

  const generateEmbedCode = useCallback(() => {
    const params = new URLSearchParams();
    if (embedSettings.autoplay) {params.set('autoplay', '1');}
    if (embedSettings.loop) {params.set('loop', '1');}
    if (!embedSettings.showControls) {params.set('controls', '0');}
    if (!embedSettings.showNavigation) {params.set('nav', '0');}
    if (embedSettings.theme !== 'auto') {params.set('theme', embedSettings.theme);}
    if (embedSettings.startSlide > 1) {params.set('start', embedSettings.startSlide.toString());}

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const src = `${embedUrl}${queryString}`;

    if (embedSettings.responsive) {
      return `<div style="position: relative; padding-bottom: ${(embedSettings.height / embedSettings.width) * 100}%; height: 0; overflow: hidden;">
  <iframe 
    src="${src}" 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
    allowfullscreen
  ></iframe>
</div>`;
    }

    return `<iframe 
  src="${src}" 
  width="${embedSettings.width}" 
  height="${embedSettings.height}" 
  frameborder="0" 
  allowfullscreen
></iframe>`;
  }, [embedUrl, embedSettings]);

  const copyToClipboard = useCallback(async (text: string, type: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const socialShareUrls = {
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Check out my presentation: ${presentationTitle}`)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    email: `mailto:?subject=${encodeURIComponent(`Presentation: ${presentationTitle}`)}&body=${encodeURIComponent(`Check out this presentation: ${shareUrl}`)}`,
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share & Embed
          </DialogTitle>
          <DialogDescription>
            Share your presentation or embed it on any website
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="share" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="share">Share Link</TabsTrigger>
            <TabsTrigger value="embed">Embed</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="space-y-6 mt-4">
            {/* Share Link */}
            <div className="space-y-3">
              <Label>Shareable Link</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="pr-10"
                  />
                  <Badge
                    variant={shareSettings.isPublic ? 'default' : 'secondary'}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    {shareSettings.isPublic ? (
                      <><Globe className="h-3 w-3 mr-1" /> Public</>
                    ) : (
                      <><Lock className="h-3 w-3 mr-1" /> Private</>
                    )}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(shareUrl, 'link')}
                >
                  {copied === 'link' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="outline" asChild>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            {/* Social Sharing */}
            <div className="space-y-3">
              <Label>Share on Social Media</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => window.open(socialShareUrls.twitter, '_blank')}
                >
                  <Twitter className="h-5 w-5 mr-2" />
                  Twitter
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => window.open(socialShareUrls.linkedin, '_blank')}
                >
                  <Linkedin className="h-5 w-5 mr-2" />
                  LinkedIn
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => window.open(socialShareUrls.facebook, '_blank')}
                >
                  <Facebook className="h-5 w-5 mr-2" />
                  Facebook
                </Button>
              </div>
            </div>

            {/* Email Share */}
            <div className="space-y-3">
              <Label>Share via Email</Label>
              <div className="flex gap-2">
                <Input placeholder="Enter email addresses" className="flex-1" />
                <Button>
                  <Mail className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>

            {/* QR Code */}
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                  <QrCode className="h-16 w-16 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">QR Code</h4>
                  <p className="text-sm text-muted-foreground">
                    Scan to view presentation on mobile
                  </p>
                  <Button variant="outline" size="sm" className="mt-2">
                    <Download className="h-4 w-4 mr-2" />
                    Download QR
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="embed" className="space-y-6 mt-4">
            {/* Embed Preview */}
            <div className="space-y-3">
              <Label>Preview</Label>
              <div
                className="bg-slate-100 rounded-lg overflow-hidden"
                style={{
                  aspectRatio: `${embedSettings.width}/${embedSettings.height}`,
                  maxHeight: '200px',
                }}
              >
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Eye className="h-8 w-8" />
                </div>
              </div>
            </div>

            {/* Embed Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Width</Label>
                <Input
                  type="number"
                  value={embedSettings.width}
                  onChange={(e) =>
                    setEmbedSettings((prev) => ({
                      ...prev,
                      width: parseInt(e.target.value) || 800,
                    }))
                  }
                  disabled={embedSettings.responsive}
                />
              </div>
              <div className="space-y-2">
                <Label>Height</Label>
                <Input
                  type="number"
                  value={embedSettings.height}
                  onChange={(e) =>
                    setEmbedSettings((prev) => ({
                      ...prev,
                      height: parseInt(e.target.value) || 600,
                    }))
                  }
                  disabled={embedSettings.responsive}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Responsive</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically resize to fit container
                  </p>
                </div>
                <Switch
                  checked={embedSettings.responsive}
                  onCheckedChange={(checked) =>
                    setEmbedSettings((prev) => ({ ...prev, responsive: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Autoplay</Label>
                <Switch
                  checked={embedSettings.autoplay}
                  onCheckedChange={(checked) =>
                    setEmbedSettings((prev) => ({ ...prev, autoplay: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Loop</Label>
                <Switch
                  checked={embedSettings.loop}
                  onCheckedChange={(checked) =>
                    setEmbedSettings((prev) => ({ ...prev, loop: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Show Controls</Label>
                <Switch
                  checked={embedSettings.showControls}
                  onCheckedChange={(checked) =>
                    setEmbedSettings((prev) => ({ ...prev, showControls: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Show Navigation</Label>
                <Switch
                  checked={embedSettings.showNavigation}
                  onCheckedChange={(checked) =>
                    setEmbedSettings((prev) => ({ ...prev, showNavigation: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Theme</Label>
                <Select
                  value={embedSettings.theme}
                  onValueChange={(value: EmbedSettings['theme']) =>
                    setEmbedSettings((prev) => ({ ...prev, theme: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (System)</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Start Slide</Label>
                <Input
                  type="number"
                  min={1}
                  value={embedSettings.startSlide}
                  onChange={(e) =>
                    setEmbedSettings((prev) => ({
                      ...prev,
                      startSlide: parseInt(e.target.value) || 1,
                    }))
                  }
                />
              </div>
            </div>

            {/* Embed Code */}
            <div className="space-y-3">
              <Label>Embed Code</Label>
              <Textarea
                value={generateEmbedCode()}
                readOnly
                className="font-mono text-xs h-32"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => copyToClipboard(generateEmbedCode(), 'embed')}
              >
                {copied === 'embed' ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Code className="h-4 w-4 mr-2" />
                    Copy Embed Code
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 mt-4">
            {/* Access Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Access Control
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Public Access</Label>
                    <p className="text-xs text-muted-foreground">
                      Anyone with the link can view
                    </p>
                  </div>
                  <Switch
                    checked={shareSettings.isPublic}
                    onCheckedChange={(checked) =>
                      setShareSettings((prev) => ({ ...prev, isPublic: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Password</Label>
                    <p className="text-xs text-muted-foreground">
                      Viewers need a password to access
                    </p>
                  </div>
                  <Switch
                    checked={shareSettings.requirePassword}
                    onCheckedChange={(checked) =>
                      setShareSettings((prev) => ({ ...prev, requirePassword: checked }))
                    }
                  />
                </div>

                {shareSettings.requirePassword && (
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={shareSettings.password}
                      onChange={(e) =>
                        setShareSettings((prev) => ({ ...prev, password: e.target.value }))
                      }
                      placeholder="Enter password"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Viewer Permissions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Viewer Permissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Allow Download</Label>
                  <Switch
                    checked={shareSettings.allowDownload}
                    onCheckedChange={(checked) =>
                      setShareSettings((prev) => ({ ...prev, allowDownload: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Allow Comments</Label>
                  <Switch
                    checked={shareSettings.allowComments}
                    onCheckedChange={(checked) =>
                      setShareSettings((prev) => ({ ...prev, allowComments: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Show Author Name</Label>
                  <Switch
                    checked={shareSettings.showAuthor}
                    onCheckedChange={(checked) =>
                      setShareSettings((prev) => ({ ...prev, showAuthor: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Expiration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Link Expiration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Expires After</Label>
                  <Select
                    value={
                      shareSettings.expiresAt
                        ? 'custom'
                        : 'never'
                    }
                    onValueChange={(value) => {
                      if (value === 'never') {
                        setShareSettings((prev) => ({ ...prev, expiresAt: null }));
                      } else {
                        const days = parseInt(value);
                        const date = new Date();
                        date.setDate(date.getDate() + days);
                        setShareSettings((prev) => ({ ...prev, expiresAt: date }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select expiration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Max Views</Label>
                  <Input
                    type="number"
                    value={shareSettings.maxViews || ''}
                    onChange={(e) =>
                      setShareSettings((prev) => ({
                        ...prev,
                        maxViews: e.target.value ? parseInt(e.target.value) : null,
                      }))
                    }
                    placeholder="Unlimited"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for unlimited views
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Analytics */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Link Analytics</p>
                    <p className="text-sm text-muted-foreground">
                      {shareSettings.accessCount} views so far
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
