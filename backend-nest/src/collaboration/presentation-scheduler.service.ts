import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface ScheduledPresentation {
  id: string;
  projectId: string;
  title: string;
  scheduledAt: Date;
  timezone: string;
  duration: number; // minutes
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
  reminders: {
    type: 'email' | 'push';
    beforeMinutes: number;
    sent: boolean;
  }[];
  attendees: {
    email: string;
    name?: string;
    status: 'invited' | 'accepted' | 'declined';
    joinedAt?: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PresentationStats {
  totalAttendees: number;
  peakAttendees: number;
  averageWatchTime: number;
  questionsAsked: number;
  pollsAnswered: number;
  engagementScore: number;
}

@Injectable()
export class PresentationSchedulerService {
  private readonly logger = new Logger(PresentationSchedulerService.name);

  constructor(private prisma: PrismaService) {}

  async schedulePresentation(
    userId: string,
    data: {
      projectId: string;
      title: string;
      scheduledAt: Date;
      timezone: string;
      duration: number;
      settings?: Partial<ScheduledPresentation['settings']>;
    },
  ): Promise<ScheduledPresentation> {
    const defaultSettings: ScheduledPresentation['settings'] = {
      autoStart: true,
      enableQA: true,
      enablePolls: true,
      enableRecording: false,
      accessType: 'private',
    };

    const scheduled: ScheduledPresentation = {
      id: `sched-${Date.now()}`,
      projectId: data.projectId,
      title: data.title,
      scheduledAt: data.scheduledAt,
      timezone: data.timezone,
      duration: data.duration,
      status: 'scheduled',
      settings: { ...defaultSettings, ...data.settings },
      reminders: [
        { type: 'email', beforeMinutes: 60, sent: false },
        { type: 'email', beforeMinutes: 15, sent: false },
        { type: 'push', beforeMinutes: 5, sent: false },
      ],
      attendees: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.logger.log(`Scheduled presentation ${scheduled.id} for ${data.scheduledAt}`);
    return scheduled;
  }

  async getScheduledPresentations(
    userId: string,
    options?: {
      status?: ScheduledPresentation['status'];
      from?: Date;
      to?: Date;
    },
  ): Promise<ScheduledPresentation[]> {
    // In production, fetch from database
    return [
      {
        id: 'sched-1',
        projectId: 'proj-1',
        title: 'Q1 Strategy Presentation',
        scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
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
        reminders: [
          { type: 'email', beforeMinutes: 60, sent: false },
          { type: 'email', beforeMinutes: 15, sent: false },
        ],
        attendees: [
          { email: 'john@example.com', name: 'John Doe', status: 'accepted' },
          { email: 'jane@example.com', name: 'Jane Smith', status: 'invited' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  async getScheduledPresentationById(id: string): Promise<ScheduledPresentation | null> {
    const all = await this.getScheduledPresentations('');
    return all.find((p) => p.id === id) || null;
  }

  async updateScheduledPresentation(
    id: string,
    updates: Partial<{
      title: string;
      scheduledAt: Date;
      duration: number;
      settings: Partial<ScheduledPresentation['settings']>;
    }>,
  ): Promise<ScheduledPresentation> {
    const existing = await this.getScheduledPresentationById(id);
    if (!existing) {
      throw new Error('Scheduled presentation not found');
    }

    const updated = {
      ...existing,
      ...updates,
      settings: { ...existing.settings, ...updates.settings },
      updatedAt: new Date(),
    };

    this.logger.log(`Updated scheduled presentation ${id}`);
    return updated;
  }

  async cancelScheduledPresentation(id: string): Promise<void> {
    this.logger.log(`Cancelled scheduled presentation ${id}`);
  }

  async inviteAttendees(
    id: string,
    emails: string[],
    message?: string,
  ): Promise<void> {
    this.logger.log(`Invited ${emails.length} attendees to presentation ${id}`);
    // Send invitation emails
  }

  async removeAttendee(id: string, email: string): Promise<void> {
    this.logger.log(`Removed attendee ${email} from presentation ${id}`);
  }

  async startPresentation(id: string): Promise<{
    sessionId: string;
    joinUrl: string;
    presenterUrl: string;
  }> {
    const sessionId = `session-${Date.now()}`;
    
    this.logger.log(`Started presentation ${id} as session ${sessionId}`);
    
    return {
      sessionId,
      joinUrl: `/live/${sessionId}`,
      presenterUrl: `/present/${sessionId}`,
    };
  }

  async endPresentation(id: string): Promise<PresentationStats> {
    this.logger.log(`Ended presentation ${id}`);
    
    return {
      totalAttendees: 25,
      peakAttendees: 22,
      averageWatchTime: 38,
      questionsAsked: 12,
      pollsAnswered: 45,
      engagementScore: 85,
    };
  }

  async getRecording(id: string): Promise<{ url: string; duration: number } | null> {
    // In production, return actual recording URL
    return {
      url: `/recordings/${id}.mp4`,
      duration: 2700, // 45 minutes in seconds
    };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processReminders(): Promise<void> {
    const now = new Date();
    const scheduled = await this.getScheduledPresentations('');

    for (const presentation of scheduled) {
      if (presentation.status !== 'scheduled') continue;

      for (const reminder of presentation.reminders) {
        if (reminder.sent) continue;

        const reminderTime = new Date(
          presentation.scheduledAt.getTime() - reminder.beforeMinutes * 60000
        );

        if (now >= reminderTime) {
          await this.sendReminder(presentation, reminder);
          reminder.sent = true;
        }
      }

      // Auto-start if enabled
      if (
        presentation.settings.autoStart &&
        now >= presentation.scheduledAt
      ) {
        await this.startPresentation(presentation.id);
      }
    }
  }

  private async sendReminder(
    presentation: ScheduledPresentation,
    reminder: ScheduledPresentation['reminders'][0],
  ): Promise<void> {
    this.logger.log(
      `Sending ${reminder.type} reminder for presentation ${presentation.id}`
    );
    // Send email or push notification
  }

  async generateMeetingLink(id: string): Promise<string> {
    return `https://present.example.com/join/${id}`;
  }

  async addToCalendar(
    id: string,
    type: 'google' | 'outlook' | 'ical',
  ): Promise<string> {
    const presentation = await this.getScheduledPresentationById(id);
    if (!presentation) {
      throw new Error('Presentation not found');
    }

    const startTime = presentation.scheduledAt.toISOString();
    const endTime = new Date(
      presentation.scheduledAt.getTime() + presentation.duration * 60000
    ).toISOString();

    switch (type) {
      case 'google':
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(presentation.title)}&dates=${startTime.replace(/[-:]/g, '').replace('.000', '')}/${endTime.replace(/[-:]/g, '').replace('.000', '')}`;
      case 'outlook':
        return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(presentation.title)}&startdt=${startTime}&enddt=${endTime}`;
      case 'ical':
        return `/api/presentations/${id}/calendar.ics`;
      default:
        throw new Error('Invalid calendar type');
    }
  }
}
