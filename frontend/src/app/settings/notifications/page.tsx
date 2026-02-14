'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Mail,
  Shield,
  Megaphone,
  FolderGit2,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

const emailPreferencesSchema = z.object({
  loginOtp: z.boolean(),
  passwordReset: z.boolean(),
  marketingEmails: z.boolean(),
  projectUpdates: z.boolean(),
  securityAlerts: z.boolean(),
  productUpdates: z.boolean(),
});

type EmailPreferences = z.infer<typeof emailPreferencesSchema>;

interface NotificationSetting {
  key: keyof EmailPreferences;
  title: string;
  description: string;
  icon: React.ElementType;
  category: 'security' | 'activity' | 'marketing';
  required?: boolean;
}

const notificationSettings: NotificationSetting[] = [
  {
    key: 'loginOtp',
    title: 'Login OTP Codes',
    description: 'Receive one-time passwords for passwordless login',
    icon: Mail,
    category: 'security',
    required: true,
  },
  {
    key: 'passwordReset',
    title: 'Password Reset',
    description: 'Receive password reset links when requested',
    icon: Shield,
    category: 'security',
    required: true,
  },
  {
    key: 'securityAlerts',
    title: 'Security Alerts',
    description: 'Get notified about suspicious activity or security concerns',
    icon: Shield,
    category: 'security',
  },
  {
    key: 'projectUpdates',
    title: 'Project Updates',
    description: 'Notifications when collaborators make changes to shared projects',
    icon: FolderGit2,
    category: 'activity',
  },
  {
    key: 'productUpdates',
    title: 'Product Updates',
    description: 'Learn about new features, improvements, and tips',
    icon: Sparkles,
    category: 'marketing',
  },
  {
    key: 'marketingEmails',
    title: 'Marketing & Promotions',
    description: 'Special offers, promotions, and newsletter',
    icon: Megaphone,
    category: 'marketing',
  },
];

const categoryLabels: Record<string, { title: string; description: string }> = {
  security: {
    title: 'Security & Authentication',
    description: 'Essential notifications for account security',
  },
  activity: {
    title: 'Activity & Collaboration',
    description: 'Stay updated on project activity and team collaboration',
  },
  marketing: {
    title: 'Product & Marketing',
    description: 'Updates about new features and promotional content',
  },
};

export default function NotificationsSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const {
    watch,
    setValue,
    handleSubmit,
    reset,
    formState: { errors: _errors },
  } = useForm<EmailPreferences>({
    resolver: zodResolver(emailPreferencesSchema),
    defaultValues: {
      loginOtp: true,
      passwordReset: true,
      marketingEmails: false,
      projectUpdates: true,
      securityAlerts: true,
      productUpdates: false,
    },
  });

  const watchedValues = watch();

  // Load user preferences
  useEffect(() => {
    async function loadPreferences() {
      try {
        const response = await api.get('/users/me/email-preferences');
        if (response.data) {
          reset(response.data);
        }
      } catch (_error) {
        // Use defaults if no preferences exist
        console.warn('Using default email preferences');
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, [reset]);

  // Track changes
  useEffect(() => {
    const subscription = watch(() => setHasChanges(true));
    return () => subscription.unsubscribe();
  }, [watch]);

  const onSubmit = async (data: EmailPreferences) => {
    setIsSaving(true);
    try {
      await api.put('/users/me/email-preferences', data);
      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated.',
      });
      setHasChanges(false);
    } catch (_error) {
      toast({
        title: 'Error saving preferences',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof EmailPreferences, checked: boolean) => {
    setValue(key, checked);
  };

  const renderSettingsByCategory = (category: string) => {
    const settings = notificationSettings.filter((s) => s.category === category);
    const { title, description } = categoryLabels[category];

    return (
      <Card key={category}>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.map((setting) => {
            const Icon = setting.icon;
            const isChecked = watchedValues[setting.key];
            const isDisabled = setting.required;

            return (
              <div
                key={setting.key}
                className="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-lg bg-muted">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {setting.title}
                      {setting.required && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {setting.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isChecked}
                  onCheckedChange={(checked) => handleToggle(setting.key, checked)}
                  disabled={isDisabled}
                  className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Notification Preferences</h2>
        <p className="text-muted-foreground mt-1">
          Manage how you receive notifications and communications from us.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-blue-900 dark:text-blue-100">
            Some notifications are required
          </p>
          <p className="text-blue-700 dark:text-blue-300 mt-0.5">
            Security-related notifications like login codes and password resets cannot be
            disabled to ensure account safety.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {['security', 'activity', 'marketing'].map((category) =>
          renderSettingsByCategory(category)
        )}

        {/* Save button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {hasChanges ? 'You have unsaved changes' : 'All changes saved'}
          </p>
          <Button type="submit" disabled={isSaving || !hasChanges}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Unsubscribe all section */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Email Preferences</CardTitle>
          <CardDescription>
            Manage your email subscription status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Unsubscribe from all marketing emails</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                You will still receive essential security and transactional emails.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => {
                setValue('marketingEmails', false);
                setValue('productUpdates', false);
                setHasChanges(true);
              }}
            >
              Unsubscribe All
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
