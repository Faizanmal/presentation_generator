'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Palette,
  Plus,
  Trash2,
  Star,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
// import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import type { BrandProfile } from '@/types';
import Image from 'next/image';

const fontOptions = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
];

const toneOptions = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'creative', label: 'Creative' },
  { value: 'technical', label: 'Technical' },
];

export function BrandProfileEditor() {
  const queryClient = useQueryClient();
  const [editingProfile, setEditingProfile] = useState<BrandProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: profiles, isLoading } = useQuery<BrandProfile[]>({
    queryKey: ['brand-profiles'],
    queryFn: () => api.getBrandProfiles(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<BrandProfile>) => api.createBrandProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-profiles'] });
      setIsCreating(false);
      toast.success('Brand profile created');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BrandProfile> }) =>
      api.updateBrandProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-profiles'] });
      setEditingProfile(null);
      toast.success('Brand profile updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBrandProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-profiles'] });
      toast.success('Brand profile deleted');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Brand Profiles</h2>
          <p className="text-muted-foreground">
            Create brand profiles for consistent AI-generated content
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <BrandProfileForm
              onSubmit={(data) => createMutation.mutate(data)}
              isLoading={createMutation.isPending}
              onCancel={() => setIsCreating(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Profile cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {profiles?.map((profile) => (
          <Card key={profile.id} className={profile.isDefault ? 'border-primary' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {profile.logo ? (
                    <Image
                      src={profile.logo}
                      alt={profile.name}
                      className="w-12 h-12 rounded-lg object-contain bg-muted"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <Palette className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {profile.name}
                      {profile.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </CardTitle>
                    {profile.industry && (
                      <CardDescription>{profile.industry}</CardDescription>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Color preview */}
              <div className="flex gap-2 mb-4">
                <div
                  className="w-8 h-8 rounded-full border"
                  style={{ backgroundColor: profile.primaryColor }}
                  title="Primary"
                />
                <div
                  className="w-8 h-8 rounded-full border"
                  style={{ backgroundColor: profile.secondaryColor }}
                  title="Secondary"
                />
                <div
                  className="w-8 h-8 rounded-full border"
                  style={{ backgroundColor: profile.accentColor }}
                  title="Accent"
                />
              </div>

              {/* Font preview */}
              <div className="text-sm text-muted-foreground mb-4">
                <span style={{ fontFamily: profile.headingFont }}>
                  {profile.headingFont}
                </span>
                {' / '}
                <span style={{ fontFamily: profile.bodyFont }}>
                  {profile.bodyFont}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditingProfile(profile)}
                >
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={profile.isDefault}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Brand Profile?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the &quot;{profile.name}&quot; brand
                        profile. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(profile.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}

        {profiles?.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Palette className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold">No brand profiles yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mt-1">
                Create a brand profile to ensure AI-generated content matches your brand
                identity.
              </p>
              <Button className="mt-4" onClick={() => setIsCreating(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Profile
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog
        open={!!editingProfile}
        onOpenChange={(open) => !open && setEditingProfile(null)}
      >
        <DialogContent className="max-w-2xl">
          {editingProfile && (
            <BrandProfileForm
              profile={editingProfile}
              onSubmit={(data) =>
                updateMutation.mutate({ id: editingProfile.id, data })
              }
              isLoading={updateMutation.isPending}
              onCancel={() => setEditingProfile(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface BrandProfileFormProps {
  profile?: BrandProfile;
  onSubmit: (data: Partial<BrandProfile>) => void;
  isLoading: boolean;
  onCancel: () => void;
}

function BrandProfileForm({
  profile,
  onSubmit,
  isLoading,
  onCancel,
}: BrandProfileFormProps) {
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    logo: profile?.logo || '',
    primaryColor: profile?.primaryColor || '#3b82f6',
    secondaryColor: profile?.secondaryColor || '#64748b',
    accentColor: profile?.accentColor || '#f59e0b',
    headingFont: profile?.headingFont || 'Inter',
    bodyFont: profile?.bodyFont || 'Inter',
    voiceTone: profile?.voiceTone || 'professional',
    industry: profile?.industry || '',
    isDefault: profile?.isDefault || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {profile ? 'Edit Brand Profile' : 'Create Brand Profile'}
        </DialogTitle>
        <DialogDescription>
          Define your brand&apos;s visual identity and voice for AI-generated content.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        {/* Name */}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right">
            Name
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="col-span-3"
            placeholder="My Brand"
            required
          />
        </div>

        {/* Colors */}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">Colors</Label>
          <div className="col-span-3 flex gap-4">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.primaryColor}
                onChange={(e) =>
                  setFormData({ ...formData, primaryColor: e.target.value })
                }
                className="w-10 h-10 rounded cursor-pointer"
              />
              <span className="text-sm">Primary</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.secondaryColor}
                onChange={(e) =>
                  setFormData({ ...formData, secondaryColor: e.target.value })
                }
                className="w-10 h-10 rounded cursor-pointer"
              />
              <span className="text-sm">Secondary</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.accentColor}
                onChange={(e) =>
                  setFormData({ ...formData, accentColor: e.target.value })
                }
                className="w-10 h-10 rounded cursor-pointer"
              />
              <span className="text-sm">Accent</span>
            </div>
          </div>
        </div>

        {/* Fonts */}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">Fonts</Label>
          <div className="col-span-3 grid grid-cols-2 gap-4">
            <Select
              value={formData.headingFont}
              onValueChange={(value) =>
                setFormData({ ...formData, headingFont: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Heading font" />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    <span style={{ fontFamily: font.value }}>{font.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={formData.bodyFont}
              onValueChange={(value) =>
                setFormData({ ...formData, bodyFont: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Body font" />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    <span style={{ fontFamily: font.value }}>{font.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Voice Tone */}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="tone" className="text-right">
            Voice Tone
          </Label>
          <Select
            value={formData.voiceTone}
            onValueChange={(value) =>
              setFormData({ ...formData, voiceTone: value })
            }
          >
            <SelectTrigger className="col-span-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {toneOptions.map((tone) => (
                <SelectItem key={tone.value} value={tone.value}>
                  {tone.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Industry */}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="industry" className="text-right">
            Industry
          </Label>
          <Input
            id="industry"
            value={formData.industry}
            onChange={(e) =>
              setFormData({ ...formData, industry: e.target.value })
            }
            className="col-span-3"
            placeholder="e.g., Technology, Finance, Healthcare"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Profile'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
