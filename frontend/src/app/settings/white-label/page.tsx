'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Boxes, Plus, Loader2, Code, Copy, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useSDKConfigurations } from '@/hooks/use-new-features';

export default function WhiteLabelPage() {
  const { configs, createConfig, getEmbedCode, getReactComponent } = useSDKConfigurations();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [embedCode, setEmbedCode] = useState<string | null>(null);
  const [reactCode, setReactCode] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {return;}
    try {
      await createConfig.mutateAsync({
        name,
        domain,
        branding: { removeBranding: false },
        features: ['viewer', 'editor'],
      });
      setOpen(false);
      setName('');
      setDomain('');
      toast.success('SDK configuration created');
    } catch {
      toast.error('Failed to create configuration');
    }
  };

  const handleGetEmbed = async (id: string) => {
    try {
      const result = await getEmbedCode.mutateAsync(id);
      setEmbedCode(result.code);
    } catch {
      toast.error('Failed to get embed code');
    }
  };

  const handleGetReact = async (id: string) => {
    try {
      const result = await getReactComponent.mutateAsync(id);
      setReactCode(result.code);
    } catch {
      toast.error('Failed to get React component');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="max-w-3xl p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="w-6 h-6 text-primary" />
            White-Label SDK
          </h1>
          <p className="text-muted-foreground mt-1">
            Create embeddable, branded presentation experiences
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Config</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create SDK Configuration</DialogTitle>
              <DialogDescription>Set up a white-label embed</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Client Portal" />
              </div>
              <div>
                <Label>Allowed Domain</Label>
                <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g., app.client.com" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createConfig.isPending || !name.trim()}>
                {createConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {configs.data?.map((cfg: { id: string; name: string; domain: string; status: string; features: string[] }) => (
          <Card key={cfg.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium">{cfg.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Globe className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{cfg.domain || 'Any domain'}</span>
                  </div>
                </div>
                <Badge variant={cfg.status === 'active' ? 'default' : 'secondary'}>
                  {cfg.status}
                </Badge>
              </div>

              <div className="flex gap-2 mb-3">
                {cfg.features?.map((f) => (
                  <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                ))}
              </div>

              <Tabs defaultValue="embed">
                <TabsList className="grid grid-cols-2 w-48">
                  <TabsTrigger value="embed">Embed</TabsTrigger>
                  <TabsTrigger value="react">React</TabsTrigger>
                </TabsList>
                <TabsContent value="embed" className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => handleGetEmbed(cfg.id)} disabled={getEmbedCode.isPending}>
                    <Code className="w-3 h-3 mr-1" /> Get Embed Code
                  </Button>
                  {embedCode && (
                    <div className="mt-2 relative">
                      <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-40">{embedCode}</pre>
                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => copyCode(embedCode)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="react" className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => handleGetReact(cfg.id)} disabled={getReactComponent.isPending}>
                    <Code className="w-3 h-3 mr-1" /> Get React Component
                  </Button>
                  {reactCode && (
                    <div className="mt-2 relative">
                      <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-40">{reactCode}</pre>
                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => copyCode(reactCode)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ))}
        {(!configs.data || configs.data.length === 0) && (
          <Card className="p-8 text-center">
            <Boxes className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground text-sm">No SDK configurations yet</p>
          </Card>
        )}
      </div>
    </div>
  );
}
