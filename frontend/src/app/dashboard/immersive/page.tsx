'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Headset, Glasses, QrCode, Loader2, ArrowLeft, Download, Cuboid, Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVRExport, useHolographic } from '@/hooks/use-new-features';
import Link from 'next/link';

export default function ImmersivePage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const { exportToVR, generateARMarker } = useVRExport(projectId);
  const { formats, createPreview } = useHolographic(projectId);
  const [vrFormat, setVrFormat] = useState('webxr');
  const [holoFormat, setHoloFormat] = useState('looking-glass');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Headset className="w-8 h-8 text-primary" />
              Immersive Presentations
            </h1>
            <p className="text-muted-foreground mt-1">
              VR, AR, and holographic presentation experiences
            </p>
          </div>
        </div>

        <Tabs defaultValue="vr" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vr" className="flex items-center gap-2"><Headset className="w-4 h-4" /> VR Mode</TabsTrigger>
            <TabsTrigger value="ar" className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> AR Mode</TabsTrigger>
            <TabsTrigger value="holographic" className="flex items-center gap-2"><Cuboid className="w-4 h-4" /> Holographic</TabsTrigger>
          </TabsList>

          <TabsContent value="vr" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>VR Presentation Export</CardTitle>
                <CardDescription>Export your presentation for virtual reality headsets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'webxr', name: 'WebXR', desc: 'Browser-based VR (Meta Quest, etc.)', icon: Headset },
                    { id: 'a-frame', name: 'A-Frame', desc: 'Lightweight VR framework', icon: Cuboid },
                    { id: 'steamvr', name: 'SteamVR', desc: 'PC VR headsets', icon: Glasses },
                  ].map(f => (
                    <Card
                      key={f.id}
                      className={`cursor-pointer transition-all ${vrFormat === f.id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
                      onClick={() => setVrFormat(f.id)}
                    >
                      <CardContent className="p-4 text-center">
                        <f.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                        <p className="font-medium text-sm">{f.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Button
                  className="w-full"
                  onClick={() => exportToVR.mutate({ format: vrFormat }, {
                    onSuccess: (data) => toast.success('VR export started! Check downloads when ready.'),
                    onError: () => toast.error('Export failed'),
                  })}
                  disabled={exportToVR.isPending}
                >
                  {exportToVR.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                  Export to VR
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AR Marker Generation</CardTitle>
                <CardDescription>Generate AR markers to view presentations in augmented reality</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-8 text-center">
                  <QrCode className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate an AR marker that viewers can scan to see your presentation in augmented reality
                  </p>
                  <Button
                    onClick={() => generateARMarker.mutate(undefined, {
                      onSuccess: () => toast.success('AR marker generated!'),
                      onError: () => toast.error('Failed to generate marker'),
                    })}
                    disabled={generateARMarker.isPending}
                  >
                    {generateARMarker.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
                    Generate AR Marker
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="holographic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Holographic Display</CardTitle>
                <CardDescription>Create holographic projections of your presentation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={holoFormat} onValueChange={setHoloFormat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="looking-glass">Looking Glass</SelectItem>
                    <SelectItem value="peppers-ghost">Pepper&apos;s Ghost</SelectItem>
                    <SelectItem value="volumetric">Volumetric Display</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  onClick={() => createPreview.mutate({ format: holoFormat }, {
                    onSuccess: () => toast.success('Holographic preview generated!'),
                    onError: () => toast.error('Failed to generate preview'),
                  })}
                  disabled={createPreview.isPending}
                >
                  {createPreview.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Cuboid className="w-4 h-4 mr-2" />}
                  Generate Holographic Preview
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
