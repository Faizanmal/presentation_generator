'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Router, Plus, Loader2, Wifi, WifiOff, Trash2, Monitor,
  Smartphone, Speaker, Tv, Watch, Send,
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
import { useIoTDevices } from '@/hooks/use-new-features';

const deviceTypeIcons: Record<string, React.ReactNode> = {
  display: <Tv className="w-5 h-5" />,
  speaker: <Speaker className="w-5 h-5" />,
  controller: <Monitor className="w-5 h-5" />,
  wearable: <Watch className="w-5 h-5" />,
  mobile: <Smartphone className="w-5 h-5" />,
};

export default function IoTDevicesPage() {
  const { devices, deviceTypes, registerDevice, sendCommand, revokeDevice } = useIoTDevices();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('display');
  const [connectionString, setConnectionString] = useState('');

  const handleRegister = async () => {
    if (!name.trim()) {return;}
    try {
      await registerDevice.mutateAsync({ name, type, connectionString });
      setOpen(false);
      setName('');
      setConnectionString('');
      toast.success('Device registered');
    } catch {
      toast.error('Failed to register device');
    }
  };

  const handleCommand = async (deviceId: string, command: string) => {
    try {
      await sendCommand.mutateAsync({ deviceId, command, params: {} });
      toast.success(`Command "${command}" sent`);
    } catch {
      toast.error('Failed to send command');
    }
  };

  const handleRevoke = async (deviceId: string) => {
    try {
      await revokeDevice.mutateAsync(deviceId);
      toast.success('Device revoked');
    } catch {
      toast.error('Failed to revoke device');
    }
  };

  return (
    <div className="max-w-3xl p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Router className="w-6 h-6 text-primary" />
            IoT Devices
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect smart devices for immersive presentations
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Device</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register IoT Device</DialogTitle>
              <DialogDescription>Connect a smart device to your presentations</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Device Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Conference Room Display" />
              </div>
              <div>
                <Label>Device Type</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {deviceTypes.data?.map((dt: { id: string; name: string }) => (
                    <option key={dt.id} value={dt.id}>{dt.name}</option>
                  )) || (
                    <>
                      <option value="display">Smart Display</option>
                      <option value="speaker">Smart Speaker</option>
                      <option value="controller">Controller</option>
                      <option value="wearable">Wearable</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <Label>Connection String (optional)</Label>
                <Input
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="mqtt://..."
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleRegister} disabled={registerDevice.isPending || !name.trim()}>
                {registerDevice.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Register
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {devices.data?.map((d: { id: string; name: string; type: string; status: string; lastSeen?: string; firmware?: string }) => (
          <Card key={d.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                {deviceTypeIcons[d.type] || <Router className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{d.name}</p>
                  <Badge variant={d.status === 'online' ? 'default' : 'secondary'} className="text-xs">
                    {d.status === 'online' ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                    {d.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground capitalize">{d.type}</p>
                {d.lastSeen && (
                  <p className="text-xs text-muted-foreground">
                    Last seen: {new Date(d.lastSeen).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCommand(d.id, 'sync')}
                  disabled={d.status !== 'online'}
                >
                  <Send className="w-3 h-3 mr-1" /> Sync
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Device?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will disconnect &quot;{d.name}&quot; from your account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleRevoke(d.id)}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!devices.data || devices.data.length === 0) && (
          <Card className="p-8 text-center">
            <Router className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground text-sm">No IoT devices connected</p>
          </Card>
        )}
      </div>
    </div>
  );
}
