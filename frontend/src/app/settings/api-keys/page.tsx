'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  KeyRound, Plus, Loader2, Copy, Trash2, Eye, EyeOff, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAPIKeys } from '@/hooks/use-new-features';

export default function APIKeysPage() {
  const { keys, usage, createKey, revokeKey } = useAPIKeys();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());

  const handleCreate = async () => {
    if (!name.trim()) {return;}
    try {
      const result = await createKey.mutateAsync({
        name,
        scopes: ['read', 'write'],
        expiresInDays: 90,
      });
      setNewKey(result.key);
      setName('');
      toast.success('API key created');
    } catch {
      toast.error('Failed to create key');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeKey.mutateAsync(id);
      toast.success('Key revoked');
    } catch {
      toast.error('Failed to revoke key');
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Copied to clipboard');
  };

  const toggleShow = (id: string) => {
    setShowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {next.delete(id);}
      else {next.add(id);}
      return next;
    });
  };

  const maskKey = (key: string) => key.slice(0, 8) + '•'.repeat(24) + key.slice(-4);

  return (
    <div className="max-w-3xl p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-primary" />
            API Keys
          </h1>
          <p className="text-muted-foreground mt-1">Manage API keys for integrations</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) {setNewKey(null); }}}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Create Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>Create a new API key for external integrations</DialogDescription>
            </DialogHeader>
            {newKey ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-600 font-medium">
                  Copy this key now. You won&apos;t be able to see it again.
                </p>
                <div className="flex gap-2">
                  <Input value={newKey} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copyKey(newKey)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Label>Key Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Production API" />
              </div>
            )}
            <DialogFooter>
              {newKey ? (
                <Button onClick={() => { setOpen(false); setNewKey(null); }}>Done</Button>
              ) : (
                <Button onClick={handleCreate} disabled={createKey.isPending || !name.trim()}>
                  {createKey.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Generate Key
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Usage */}
      {usage.data && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{usage.data.totalRequests?.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Requests</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{usage.data.requestsToday?.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{usage.data.rateLimitRemaining?.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Rate Limit Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keys List */}
      <div className="space-y-3">
        {keys.data?.map((k: { id: string; name: string; key: string; createdAt: string; lastUsed?: string; status: string; scopes: string[] }) => (
          <Card key={k.id} className={k.status === 'revoked' ? 'opacity-50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{k.name}</p>
                    <Badge variant={k.status === 'active' ? 'default' : 'destructive'} className="text-xs">
                      {k.status}
                    </Badge>
                    {k.scopes.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      {showKeys.has(k.id) ? k.key : maskKey(k.key || '••••••••••••••••••••••••••••••••')}
                    </code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleShow(k.id)}>
                      {showKeys.has(k.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyKey(k.key)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span><Clock className="w-3 h-3 inline mr-1" />Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                    {k.lastUsed && <span>Last used: {new Date(k.lastUsed).toLocaleDateString()}</span>}
                  </div>
                </div>
                {k.status === 'active' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently revoke &quot;{k.name}&quot;. Any integrations using this key will stop working.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRevoke(k.id)}>Revoke</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!keys.data || keys.data.length === 0) && (
          <Card className="p-8 text-center">
            <KeyRound className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground text-sm">No API keys yet</p>
          </Card>
        )}
      </div>
    </div>
  );
}
