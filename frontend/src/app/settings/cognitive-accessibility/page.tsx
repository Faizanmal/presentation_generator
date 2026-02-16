'use client';

import { toast } from 'sonner';
import {
  BrainCircuit, Loader2, Palette, Type, Gauge, Eye, LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useCognitiveAccessibility } from '@/hooks/use-new-features';

export default function CognitiveAccessibilityPage() {
  const { profile, presets, updateProfile, applyPreset, simplifyText } = useCognitiveAccessibility();

  const handleUpdate = async (partial: Record<string, unknown>) => {
    try {
      await updateProfile.mutateAsync(partial);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const handlePreset = async (presetId: string) => {
    try {
      await applyPreset.mutateAsync(presetId);
      toast.success('Preset applied');
    } catch {
      toast.error('Failed to apply preset');
    }
  };

  const p = profile.data || {};

  return (
    <div className="max-w-3xl p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-primary" />
          Cognitive Accessibility
        </h1>
        <p className="text-muted-foreground mt-1">
          Adjust presentations for different cognitive needs
        </p>
      </div>

      {/* Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Presets</CardTitle>
          <CardDescription>Apply pre-configured accessibility profiles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {presets.data?.map((preset: { id: string; name: string; description: string }) => (
              <div
                key={preset.id}
                className="p-4 rounded-lg border hover:border-primary cursor-pointer transition-colors"
                onClick={() => handlePreset(preset.id)}
              >
                <p className="font-medium text-sm">{preset.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="w-5 h-5" /> Visual Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Reduce Animations</Label>
              <p className="text-sm text-muted-foreground">Minimize motion for vestibular sensitivity</p>
            </div>
            <Switch
              checked={p.reduceAnimations || false}
              onCheckedChange={(v) => handleUpdate({ reduceAnimations: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>High Contrast Mode</Label>
              <p className="text-sm text-muted-foreground">Increase contrast ratios</p>
            </div>
            <Switch
              checked={p.highContrast || false}
              onCheckedChange={(v) => handleUpdate({ highContrast: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Dyslexia-Friendly Font</Label>
              <p className="text-sm text-muted-foreground">Use OpenDyslexic or similar fonts</p>
            </div>
            <Switch
              checked={p.dyslexiaFont || false}
              onCheckedChange={(v) => handleUpdate({ dyslexiaFont: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Type className="w-5 h-5" /> Content Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Reading Level</Label>
            <p className="text-sm text-muted-foreground mb-3">Adjust content complexity</p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">Simple</span>
              <Slider
                value={[p.readingLevel || 5]}
                min={1}
                max={10}
                step={1}
                onValueChange={([v]) => handleUpdate({ readingLevel: v })}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">Advanced</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Simplify Text</Label>
              <p className="text-sm text-muted-foreground">AI rewrites complex text to simpler language</p>
            </div>
            <Switch
              checked={p.autoSimplify || false}
              onCheckedChange={(v) => handleUpdate({ autoSimplify: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Focus Mode</Label>
              <p className="text-sm text-muted-foreground">Highlight current content, dim the rest</p>
            </div>
            <Switch
              checked={p.focusMode || false}
              onCheckedChange={(v) => handleUpdate({ focusMode: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gauge className="w-5 h-5" /> Pacing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Auto-Advance Speed</Label>
            <p className="text-sm text-muted-foreground mb-3">Adjust slide transition timing</p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">Slow</span>
              <Slider
                value={[p.paceMultiplier || 1]}
                min={0.5}
                max={2}
                step={0.1}
                onValueChange={([v]) => handleUpdate({ paceMultiplier: v })}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">Fast</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
