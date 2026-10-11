'use client';

import { useCallback, useMemo, useState } from 'react';
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
import {
  Share2,
  Code,
  Mail,
  Copy,
  Check,
  Eye,
  Lock,
  Globe,
  Users,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { FaTwitter, FaLinkedin, FaFacebook } from 'react-icons/fa';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Project } from '@/types';

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
  shareToken?: string | null;
  isPublic?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  onProjectUpdated?: (project: Project) => void;
}

export function EmbedSharePanel({
  presentationId,
  presentationTitle,
  shareToken,
  isPublic = false,
  open,
  onOpenChange,
  showTrigger = true,
  onProjectUpdated,
}: EmbedSharePanelProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;
  const setIsOpen = onOpenChange || setUncontrolledOpen;

  const [copied, setCopied] = useState<string | null>(null);
  const [publicAccess, setPublicAccess] = useState(isPublic);
  const [prevIsPublic, setPrevIsPublic] = useState(isPublic);
  const [currentShareToken, setCurrentShareToken] = useState(shareToken || null);
  const [prevShareToken, setPrevShareToken] = useState(shareToken);
  const [savingPublic, setSavingPublic] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'VIEWER' | 'EDITOR'>('VIEWER');
  const [inviting, setInviting] = useState(false);

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

  // Sync local state when parent props change (adjust during render — avoids effect setState)
  if (isPublic !== prevIsPublic) {
    setPrevIsPublic(isPublic);
    setPublicAccess(isPublic);
  }
  if (shareToken !== prevShareToken) {
    setPrevShareToken(shareToken);
    setCurrentShareToken(shareToken || null);
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const publicPath = currentShareToken || presentationId;
  const shareUrl = `${baseUrl}/view/${publicPath}`;
  const embedUrl = `${baseUrl}/embed/${publicPath}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}`;

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
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handlePublicToggle = useCallback(async (checked: boolean) => {
    setPublicAccess(checked);
    setSavingPublic(true);
    try {
      const updated = await api.updateProject(presentationId, { isPublic: checked });
      setCurrentShareToken(updated.shareToken);
      onProjectUpdated?.(updated);
      toast.success(checked ? 'Anyone with the link can view this presentation' : 'Link access turned off');
    } catch {
      setPublicAccess(!checked);
      toast.error('Could not update sharing');
    } finally {
      setSavingPublic(false);
    }
  }, [onProjectUpdated, presentationId]);

  const handleInvite = useCallback(async () => {
    const email = inviteEmail.trim();
    if (!email.includes('@')) {
      toast.error('Enter a valid email');
      return;
    }
    setInviting(true);
    try {
      await api.addCollaborator(presentationId, email, inviteRole);
      toast.success(`Invited ${email} as ${inviteRole.toLowerCase()}`);
      setInviteEmail('');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'User must already have an account to be added as a collaborator';
      toast.error(message);
    } finally {
      setInviting(false);
    }
  }, [inviteEmail, inviteRole, presentationId]);

  const socialShareUrls = useMemo(() => ({
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Check out my presentation: ${presentationTitle}`)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    email: `mailto:?subject=${encodeURIComponent(`Presentation: ${presentationTitle}`)}&body=${encodeURIComponent(`Check out this presentation: ${shareUrl}`)}`,
  }), [presentationTitle, shareUrl]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share & Embed
          </DialogTitle>
          <DialogDescription>
            Publish a view link, invite collaborators, or embed this presentation
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="share" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="share">Share Link</TabsTrigger>
            <TabsTrigger value="embed">Embed</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="space-y-6 mt-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <div>
                <Label>Public access</Label>
                <p className="text-xs text-muted-foreground">
                  Anyone with the link can view, without signing in
                </p>
              </div>
              <div className="flex items-center gap-2">
                {savingPublic && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                <Switch
                  checked={publicAccess}
                  onCheckedChange={(checked) => void handlePublicToggle(checked)}
                  disabled={savingPublic}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Shareable Link</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="pr-24"
                  />
                  <Badge
                    variant={publicAccess ? 'default' : 'secondary'}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    {publicAccess ? (
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
              {!publicAccess && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Turn on public access so people without an account can open this link.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label>Share on Social Media</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => window.open(socialShareUrls.twitter, '_blank')}
                >
                  <FaTwitter className="h-5 w-5 mr-2" />
                  Twitter
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => window.open(socialShareUrls.linkedin, '_blank')}
                >
                  <FaLinkedin className="h-5 w-5 mr-2" />
                  LinkedIn
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => window.open(socialShareUrls.facebook, '_blank')}
                >
                  <FaFacebook className="h-5 w-5 mr-2" />
                  Facebook
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Share via Email</Label>
              <Button variant="outline" className="w-full" asChild>
                <a href={socialShareUrls.email}>
                  <Mail className="h-4 w-4 mr-2" />
                  Open email draft
                </a>
              </Button>
            </div>

            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl}
                  alt="QR code for presentation link"
                  width={96}
                  height={96}
                  className="rounded-lg bg-white"
                />
                <div className="flex-1">
                  <h4 className="font-medium">QR Code</h4>
                  <p className="text-sm text-muted-foreground">
                    Scan to open the presentation on mobile
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="embed" className="space-y-6 mt-4">
            <div className="space-y-3">
              <Label>Preview</Label>
              <div
                className="bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden"
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

          <TabsContent value="people" className="space-y-6 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Invite a collaborator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Collaborators must already have an account. They will get editor or viewer access to this presentation.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={inviteRole}
                    onValueChange={(value: 'VIEWER' | 'EDITOR') => setInviteRole(value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                      <SelectItem value="EDITOR">Editor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => void handleInvite()} disabled={inviting} className="w-full">
                  {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send invite
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
