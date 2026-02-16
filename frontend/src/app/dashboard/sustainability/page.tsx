'use client';

import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Leaf, ArrowLeft, Loader2, Zap, Recycle, Award, TreePine,
  Droplets, Sun, Wind, BarChart3, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useEcoFriendly } from '@/hooks/use-new-features';
import Link from 'next/link';

export default function EcoSustainabilityPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const { settings, tips, optimize, updateSettings, trackMetrics } = useEcoFriendly(projectId);

  const handleOptimize = async () => {
    if (!projectId) {
      toast.error('Select a project first');
      return;
    }
    try {
      await optimize.mutateAsync({
        targets: ['fileSize', 'energy', 'bandwidth'],
        aggressiveness: 'balanced',
      });
      toast.success('Presentation optimized for sustainability');
    } catch {
      toast.error('Failed to optimize');
    }
  };

  const handleToggle = async (key: string, value: boolean) => {
    try {
      await updateSettings.mutateAsync({ [key]: value });
      toast.success('Setting updated');
    } catch {
      toast.error('Failed to update');
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
              <Leaf className="w-8 h-8 text-green-500" />
              Eco-Friendly Presentations
            </h1>
            <p className="text-muted-foreground mt-1">
              Reduce environmental impact while creating great content
            </p>
          </div>
        </div>

        {/* Eco Score */}
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Eco Score</p>
                <p className="text-4xl font-bold text-green-600">{settings.data?.ecoScore || 0}/100</p>
              </div>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <Zap className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                  <p className="text-sm font-medium">{settings.data?.energySaved || '0'}kWh</p>
                  <p className="text-xs text-muted-foreground">Energy Saved</p>
                </div>
                <div>
                  <Droplets className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                  <p className="text-sm font-medium">{settings.data?.dataSaved || '0'}MB</p>
                  <p className="text-xs text-muted-foreground">Data Saved</p>
                </div>
                <div>
                  <TreePine className="w-5 h-5 mx-auto text-green-600 mb-1" />
                  <p className="text-sm font-medium">{settings.data?.co2Saved || '0'}g</p>
                  <p className="text-xs text-muted-foreground">CO₂ Avoided</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Optimize */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Recycle className="w-5 h-5" /> Optimize Presentation
            </CardTitle>
            <CardDescription>Reduce file size, energy use, and bandwidth consumption</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleOptimize}
              disabled={optimize.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {optimize.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Leaf className="w-4 h-4 mr-2" />}
              Eco-Optimize Now
            </Button>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5" /> Eco Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Compress Images</Label>
                <p className="text-sm text-muted-foreground">Reduce image sizes without visible quality loss</p>
              </div>
              <Switch
                checked={settings.data?.autoCompress || false}
                onCheckedChange={(v) => handleToggle('autoCompress', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Dark Mode Default</Label>
                <p className="text-sm text-muted-foreground">Use dark themes to save screen energy (OLED)</p>
              </div>
              <Switch
                checked={settings.data?.darkModeDefault || false}
                onCheckedChange={(v) => handleToggle('darkModeDefault', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Lazy Load Media</Label>
                <p className="text-sm text-muted-foreground">Load media only when slides are viewed</p>
              </div>
              <Switch
                checked={settings.data?.lazyLoad || false}
                onCheckedChange={(v) => handleToggle('lazyLoad', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Efficient Animations</Label>
                <p className="text-sm text-muted-foreground">Use GPU-friendly CSS animations over JS</p>
              </div>
              <Switch
                checked={settings.data?.efficientAnimations || false}
                onCheckedChange={(v) => handleToggle('efficientAnimations', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sun className="w-5 h-5" /> Eco Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tips.data?.map((tip: { title: string; description: string; impact: string }, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{tip.title}</p>
                    <Badge variant="outline" className="text-xs text-green-600 border-green-600">{tip.impact}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{tip.description}</p>
                </div>
              ))}
              {(!tips.data || tips.data.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Eco tips will appear based on your usage
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
