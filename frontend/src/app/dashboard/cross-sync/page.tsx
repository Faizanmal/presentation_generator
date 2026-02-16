'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  MonitorSmartphone, RefreshCw, Loader2, ArrowLeft, Laptop, Smartphone,
  Tablet, CheckCircle2, AlertTriangle, Wifi, WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCrossPlatformSync } from '@/hooks/use-new-features';
import Link from 'next/link';

const deviceIcons: Record<string, React.ReactNode> = {
  desktop: <Laptop className="w-5 h-5" />,
  mobile: <Smartphone className="w-5 h-5" />,
  tablet: <Tablet className="w-5 h-5" />,
};

export default function CrossSyncPage() {
  const { devices, syncStatus, registerDevice, resolveConflict } = useCrossPlatformSync();
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState('desktop');

  const handleRegister = async () => {
    if (!deviceName.trim()) return;
    try {
      await registerDevice.mutateAsync({
        name: deviceName,
        type: deviceType,
        capabilities: ['edit', 'view', 'present'],
      });
      setDeviceName('');
      toast.success('Device registered');
    } catch {
      toast.error('Failed to register device');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MonitorSmartphone className="w-8 h-8 text-primary" />
              Cross-Platform Sync
            </h1>
            <p className="text-muted-foreground mt-1">Seamlessly sync presentations across all devices</p>
          </div>
        </div>

        {/* Sync Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            {syncStatus.data ? (
              <div className="flex items-center gap-4">
                {syncStatus.data.synced ? (
                  <Badge className="bg-green-500/10 text-green-500">
                    <Wifi className="w-3 h-3 mr-1" /> All Synced
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <WifiOff className="w-3 h-3 mr-1" /> Out of Sync
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  Last synced: {syncStatus.data.lastSync ? new Date(syncStatus.data.lastSync).toLocaleString() : 'Never'}
                </span>
                {syncStatus.data.conflicts > 0 && (
                  <Badge variant="outline" className="text-amber-500 border-amber-500">
                    <AlertTriangle className="w-3 h-3 mr-1" /> {syncStatus.data.conflicts} conflict(s)
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Loading status...</p>
            )}
          </CardContent>
        </Card>

        {/* Register Device */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Register Device</CardTitle>
            <CardDescription>Add a new device for syncing</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <div className="flex-1">
              <Label className="sr-only">Device Name</Label>
              <Input
                placeholder="Device name (e.g., Work Laptop)"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
              />
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
            >
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
              <option value="tablet">Tablet</option>
            </select>
            <Button onClick={handleRegister} disabled={registerDevice.isPending || !deviceName.trim()}>
              {registerDevice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register'}
            </Button>
          </CardContent>
        </Card>

        {/* Devices */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Connected Devices</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.data?.map((d: { id: string; name: string; type: string; lastSeen: string; status: string }) => (
              <Card key={d.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    {deviceIcons[d.type] || <Laptop className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{d.type}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {d.status === 'online' ? (
                        <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Online
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Offline</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last seen: {new Date(d.lastSeen).toLocaleTimeString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!devices.data || devices.data.length === 0) && (
              <Card className="col-span-full p-8 text-center">
                <MonitorSmartphone className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground text-sm">No devices registered yet</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
