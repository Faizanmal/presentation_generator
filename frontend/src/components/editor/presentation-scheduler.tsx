'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addMinutes } from 'date-fns';
import {
  Calendar,
  Clock,
  Users,
  Video,
  MessageSquare,
  BarChart3,
  Settings,
  Plus,
  Trash2,
  Edit,
  Copy,
  ExternalLink,
  Mail,
  Play,
  X,
  Check,
  Loader2,
  CalendarPlus,
  Link,
  Globe,
  Lock,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface ScheduledPresentation {
  id: string;
  projectId: string;
  title: string;
  scheduledAt: string;
  timezone: string;
  duration: number;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  settings: {
    autoStart: boolean;
    enableQA: boolean;
    enablePolls: boolean;
    enableRecording: boolean;
    accessType: 'public' | 'private' | 'password';
    password?: string;
    maxAttendees?: number;
  };
  attendees: {
    email: string;
    name?: string;
    status: 'invited' | 'accepted' | 'declined';
  }[];
}

interface PresentationSchedulerProps {
  projectId: string;
  projectTitle: string;
}

const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'GMT (London)' },
  { value: 'Europe/Paris', label: 'CET (Paris)' },
  { value: 'Asia/Tokyo', label: 'JST (Tokyo)' },
  { value: 'Asia/Shanghai', label: 'CST (Shanghai)' },
  { value: 'Australia/Sydney', label: 'AEST (Sydney)' },
];

const durations = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

export function PresentationScheduler({
  projectId,
  projectTitle,
}: PresentationSchedulerProps) {
  const queryClient = useQueryClient();
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedPresentation, setSelectedPresentation] = useState<ScheduledPresentation | null>(null);
  const [inviteEmails, setInviteEmails] = useState('');

  // Form state
  const [title, setTitle] = useState(projectTitle);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [duration, setDuration] = useState(30);
  const [enableQA, setEnableQA] = useState(true);
  const [enablePolls, setEnablePolls] = useState(true);
  const [enableRecording, setEnableRecording] = useState(false);
  const [accessType, setAccessType] = useState<'public' | 'private' | 'password'>('private');
  const [password, setPassword] = useState('');

  // Fetch scheduled presentations
  const { data: presentations, isLoading } = useQuery({
    queryKey: ['scheduled-presentations', projectId],
    queryFn: () => api.get(`/presentations/scheduled?projectId=${projectId}`),
  });

  // Schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: (data: any) => api.post('/presentations/schedule', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-presentations'] });
      setShowScheduleDialog(false);
      resetForm();
      toast.success('Presentation scheduled!');
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/presentations/scheduled/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-presentations'] });
      toast.success('Presentation cancelled');
    },
  });

  // Start mutation
  const startMutation = useMutation({
    mutationFn: (id: string) => api.post(`/presentations/scheduled/${id}/start`),
    onSuccess: (data) => {
      window.open((data as any).presenterUrl, '_blank');
    },
  });

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: ({ id, emails }: { id: string; emails: string[] }) =>
      api.post(`/presentations/scheduled/${id}/invite`, { emails }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-presentations'] });
      setInviteEmails('');
      toast.success('Invitations sent!');
    },
  });

  const resetForm = () => {
    setTitle(projectTitle);
    setDate('');
    setTime('');
    setTimezone('America/New_York');
    setDuration(30);
    setEnableQA(true);
    setEnablePolls(true);
    setEnableRecording(false);
    setAccessType('private');
    setPassword('');
  };

  const handleSchedule = () => {
    if (!date || !time) {
      toast.error('Please select date and time');
      return;
    }

    const scheduledAt = new Date(`${date}T${time}`);
    
    scheduleMutation.mutate({
      projectId,
      title,
      scheduledAt,
      timezone,
      duration,
      settings: {
        autoStart: true,
        enableQA,
        enablePolls,
        enableRecording,
        accessType,
        password: accessType === 'password' ? password : undefined,
      },
    });
  };

  const handleInvite = (presentationId: string) => {
    const emails = inviteEmails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e.includes('@'));
    
    if (emails.length === 0) {
      toast.error('Please enter valid email addresses');
      return;
    }

    inviteMutation.mutate({ id: presentationId, emails });
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`https://present.example.com/join/${id}`);
    toast.success('Link copied!');
  };

  const getStatusBadge = (status: ScheduledPresentation['status']) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="secondary">Scheduled</Badge>;
      case 'live':
        return <Badge className="bg-red-500">Live</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
    }
  };

  const getAccessIcon = (type: string) => {
    switch (type) {
      case 'public':
        return <Globe className="h-4 w-4" />;
      case 'private':
        return <Lock className="h-4 w-4" />;
      case 'password':
        return <Key className="h-4 w-4" />;
      default:
        return <Lock className="h-4 w-4" />;
    }
  };

  // Mock data
  const mockPresentations: ScheduledPresentation[] = presentations?.data || [
    {
      id: 'sched-1',
      projectId,
      title: 'Q1 Strategy Presentation',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      timezone: 'America/New_York',
      duration: 45,
      status: 'scheduled',
      settings: {
        autoStart: true,
        enableQA: true,
        enablePolls: true,
        enableRecording: true,
        accessType: 'private',
      },
      attendees: [
        { email: 'john@example.com', name: 'John Doe', status: 'accepted' },
        { email: 'jane@example.com', name: 'Jane Smith', status: 'invited' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-purple-500" />
            Schedule Presentation
          </h2>
          <p className="text-sm text-slate-500">
            Schedule live presentations and invite attendees
          </p>
        </div>
        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Schedule Presentation</DialogTitle>
              <DialogDescription>
                Set up a live presentation session
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duration</Label>
                  <Select
                    value={duration.toString()}
                    onValueChange={(v) => setDuration(parseInt(v))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {durations.map((d) => (
                        <SelectItem key={d.value} value={d.value.toString()}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Options</Label>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Enable Q&A</span>
                  <Switch checked={enableQA} onCheckedChange={setEnableQA} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Enable Polls</span>
                  <Switch checked={enablePolls} onCheckedChange={setEnablePolls} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Record Presentation</span>
                  <Switch checked={enableRecording} onCheckedChange={setEnableRecording} />
                </div>
              </div>

              <div>
                <Label>Access</Label>
                <Select value={accessType} onValueChange={(v: any) => setAccessType(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private (Invite Only)</SelectItem>
                    <SelectItem value="public">Public (Anyone with link)</SelectItem>
                    <SelectItem value="password">Password Protected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {accessType === 'password' && (
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter access password"
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSchedule} disabled={scheduleMutation.isPending}>
                {scheduleMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Scheduled Presentations */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : mockPresentations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-slate-400 mb-4" />
            <h3 className="font-medium text-lg mb-2">No scheduled presentations</h3>
            <p className="text-sm text-slate-500 text-center max-w-md">
              Schedule your first live presentation to engage with your audience
              in real-time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {mockPresentations.map((presentation) => (
            <Card key={presentation.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{presentation.title}</CardTitle>
                      {getStatusBadge(presentation.status)}
                    </div>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(presentation.scheduledAt), 'PPP')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(presentation.scheduledAt), 'p')}
                      </span>
                      <span className="flex items-center gap-1">
                        {getAccessIcon(presentation.settings.accessType)}
                        {presentation.settings.accessType}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {presentation.status === 'scheduled' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => startMutation.mutate(presentation.id)}
                          disabled={startMutation.isPending}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Start Now
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => copyLink(presentation.id)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <CalendarPlus className="h-4 w-4 mr-2" />
                              Add to Calendar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => cancelMutation.mutate(presentation.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm text-slate-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {presentation.duration} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {presentation.attendees.length} invited
                  </span>
                  {presentation.settings.enableQA && (
                    <Badge variant="outline" className="gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Q&A
                    </Badge>
                  )}
                  {presentation.settings.enablePolls && (
                    <Badge variant="outline" className="gap-1">
                      <BarChart3 className="h-3 w-3" />
                      Polls
                    </Badge>
                  )}
                  {presentation.settings.enableRecording && (
                    <Badge variant="outline" className="gap-1">
                      <Video className="h-3 w-3" />
                      Recording
                    </Badge>
                  )}
                </div>

                {/* Attendees */}
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {presentation.attendees.slice(0, 5).map((attendee, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-medium"
                      >
                        {attendee.name?.[0] || attendee.email[0].toUpperCase()}
                      </div>
                    ))}
                  </div>
                  {presentation.attendees.length > 5 && (
                    <span className="text-sm text-slate-500">
                      +{presentation.attendees.length - 5} more
                    </span>
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Mail className="h-4 w-4 mr-1" />
                        Invite
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Attendees</DialogTitle>
                        <DialogDescription>
                          Enter email addresses to invite
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Textarea
                          placeholder="email@example.com, another@example.com"
                          value={inviteEmails}
                          onChange={(e) => setInviteEmails(e.target.value)}
                          rows={4}
                        />
                        <p className="text-xs text-slate-500 mt-2">
                          Separate emails with commas or new lines
                        </p>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => handleInvite(presentation.id)}
                          disabled={inviteMutation.isPending}
                        >
                          {inviteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4 mr-2" />
                          )}
                          Send Invites
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
