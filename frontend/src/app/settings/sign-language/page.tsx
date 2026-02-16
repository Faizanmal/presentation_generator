'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Hand, Loader2, Globe, Check, Languages, Play, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSignLanguage } from '@/hooks/use-new-features';

export default function SignLanguagePage() {
  const { config, supportedLanguages, updateConfig } = useSignLanguage();

  const handleToggle = async (enabled: boolean) => {
    try {
      await updateConfig.mutateAsync({ enabled });
      toast.success(enabled ? 'Sign language enabled' : 'Sign language disabled');
    } catch {
      toast.error('Failed to update settings');
    }
  };

  const handleLanguageChange = async (language: string) => {
    try {
      await updateConfig.mutateAsync({ language });
      toast.success('Sign language updated');
    } catch {
      toast.error('Failed to update language');
    }
  };

  return (
    <div className="max-w-3xl p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Hand className="w-6 h-6 text-primary" />
          Sign Language
        </h1>
        <p className="text-muted-foreground mt-1">
          Auto-generate sign language overlays for presentations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sign Language Overlay</CardTitle>
          <CardDescription>Enable real-time sign language translation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Sign Language</Label>
              <p className="text-sm text-muted-foreground">Show sign language avatar during presentations</p>
            </div>
            <Switch
              checked={config.data?.enabled || false}
              onCheckedChange={handleToggle}
              disabled={updateConfig.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Avatar Position</Label>
              <p className="text-sm text-muted-foreground">Where to display the interpreter</p>
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={config.data?.position || 'bottom-right'}
              onChange={(e) => updateConfig.mutateAsync({ position: e.target.value })}
            >
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="top-right">Top Right</option>
              <option value="top-left">Top Left</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Avatar Size</Label>
              <p className="text-sm text-muted-foreground">Size of the interpreter overlay</p>
            </div>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={config.data?.size || 'medium'}
              onChange={(e) => updateConfig.mutateAsync({ size: e.target.value })}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5" /> Supported Languages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {supportedLanguages.data?.map((lang: { code: string; name: string; region: string }) => (
              <div
                key={lang.code}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  config.data?.language === lang.code
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => handleLanguageChange(lang.code)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{lang.name}</p>
                    <p className="text-xs text-muted-foreground">{lang.region}</p>
                  </div>
                  {config.data?.language === lang.code && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
              </div>
            ))}
            {(!supportedLanguages.data || supportedLanguages.data.length === 0) && (
              <p className="text-sm text-muted-foreground col-span-2">Loading supported languages...</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
