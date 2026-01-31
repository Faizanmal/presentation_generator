import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface TeamPerformanceMetrics {
  totalPresentations: number;
  publishedPresentations: number;
  totalEdits: number;
  avgTimeToPublish: number; // in hours
  avgRevisions: number;
  activeCollaborations: number;
}

export interface MemberContribution {
  userId: string;
  userName: string;
  presentationsCreated: number;
  presentationsEdited: number;
  slidesCreated: number;
  blocksCreated: number;
  totalEdits: number;
  commentsAdded: number;
  approvalsProcessed: number;
  avgTimeToComplete: number;
}

export interface RevisionHeatmap {
  slideId: string;
  slideNumber: number;
  slideTitle?: string;
  totalRevisions: number;
  revisionsByUser: Record<string, number>;
  revisionsByDay: Record<string, number>;
  hotspots: Array<{
    blockId: string;
    revisionCount: number;
    lastEditedBy: string;
    lastEditedAt: Date;
  }>;
}

export interface ActivityTimeline {
  id: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  targetId: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface TeamDashboard {
  organizationId: string;
  organizationName: string;
  period: { start: Date; end: Date };
  overallMetrics: TeamPerformanceMetrics;
  topContributors: MemberContribution[];
  recentActivity: ActivityTimeline[];
  productivityTrends: {
    date: string;
    presentationsCreated: number;
    edits: number;
    collaborationSessions: number;
  }[];
}

@Injectable()
export class TeamAnalyticsService {
  private readonly logger = new Logger(TeamAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get team performance metrics for an organization
   */
  async getTeamPerformance(
    organizationId: string,
    period?: { start: Date; end: Date },
  ): Promise<TeamPerformanceMetrics> {
    const dateFilter = period ? {
      createdAt: {
        gte: period.start,
        lte: period.end,
      },
    } : {};

    // Get organization members
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const userIds = members.map(m => m.userId);

    // Total presentations
    const totalPresentations = await this.prisma.project.count({
      where: {
        ownerId: { in: userIds },
        ...dateFilter,
      },
    });

    // Published presentations
    const publishedPresentations = await this.prisma.project.count({
      where: {
        ownerId: { in: userIds },
        status: 'PUBLISHED',
        ...dateFilter,
      },
    });

    // Total edits (from activity log)
    const totalEdits = await this.prisma.activityLog.count({
      where: {
        userId: { in: userIds },
        action: { in: ['edit', 'update', 'create_slide', 'create_block'] },
        ...dateFilter,
      },
    });

    // Average time to publish (from draft to published)
    const publishedProjects = await this.prisma.project.findMany({
      where: {
        ownerId: { in: userIds },
        status: 'PUBLISHED',
        publishedAt: { not: null },
        ...dateFilter,
      },
      select: {
        createdAt: true,
        publishedAt: true,
      },
    });

    const avgTimeToPublish = publishedProjects.length > 0
      ? publishedProjects.reduce((acc, p) => {
          const hours = (p.publishedAt!.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60);
          return acc + hours;
        }, 0) / publishedProjects.length
      : 0;

    // Average revisions per project
    const revisionCounts = await this.prisma.projectVersion.groupBy({
      by: ['projectId'],
      _count: true,
      where: {
        project: {
          ownerId: { in: userIds },
        },
        ...dateFilter,
      },
    });

    const avgRevisions = revisionCounts.length > 0
      ? revisionCounts.reduce((acc, r) => acc + r._count, 0) / revisionCounts.length
      : 0;

    // Active collaborations
    const activeCollaborations = await this.prisma.collaborationSession.count({
      where: {
        project: {
          ownerId: { in: userIds },
        },
        isActive: true,
      },
    });

    return {
      totalPresentations,
      publishedPresentations,
      totalEdits,
      avgTimeToPublish: Math.round(avgTimeToPublish * 10) / 10,
      avgRevisions: Math.round(avgRevisions * 10) / 10,
      activeCollaborations,
    };
  }

  /**
   * Get individual member contributions
   */
  async getMemberContributions(
    organizationId: string,
    period?: { start: Date; end: Date },
  ): Promise<MemberContribution[]> {
    const dateFilter = period ? {
      createdAt: {
        gte: period.start,
        lte: period.end,
      },
    } : {};

    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const contributions: MemberContribution[] = [];

    for (const member of members) {
      const userId = member.userId;
      const userName = member.user.name || member.user.email;

      // Presentations created
      const presentationsCreated = await this.prisma.project.count({
        where: { ownerId: userId, ...dateFilter },
      });

      // Presentations edited (via activity log)
      const editedProjects = await this.prisma.activityLog.findMany({
        where: {
          userId,
          action: { in: ['edit', 'update'] },
          targetType: 'project',
          ...dateFilter,
        },
        distinct: ['targetId'],
      });

      // Slides created
      const slidesCreated = await this.prisma.slide.count({
        where: { createdById: userId, ...dateFilter },
      });

      // Blocks created
      const blocksCreated = await this.prisma.block.count({
        where: { createdById: userId, ...dateFilter },
      });

      // Total edits
      const totalEdits = await this.prisma.activityLog.count({
        where: {
          userId,
          action: { in: ['edit', 'update', 'create_slide', 'create_block', 'delete'] },
          ...dateFilter,
        },
      });

      // Comments
      const commentsAdded = await this.prisma.comment.count({
        where: { userId, ...dateFilter },
      });

      // Approvals processed
      const approvalsProcessed = await this.prisma.approvalRequest.count({
        where: {
          approvals: {
            path: ['$[*].approverId'],
            array_contains: userId,
          },
          ...dateFilter,
        },
      });

      // Avg time to complete (first edit to last edit)
      const userProjects = await this.prisma.project.findMany({
        where: { ownerId: userId, status: 'PUBLISHED', ...dateFilter },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const avgTimeToComplete = userProjects.length > 0
        ? userProjects.reduce((acc, p) => {
            const hours = (p.updatedAt.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60);
            return acc + hours;
          }, 0) / userProjects.length
        : 0;

      contributions.push({
        userId,
        userName,
        presentationsCreated,
        presentationsEdited: editedProjects.length,
        slidesCreated,
        blocksCreated,
        totalEdits,
        commentsAdded,
        approvalsProcessed,
        avgTimeToComplete: Math.round(avgTimeToComplete * 10) / 10,
      });
    }

    // Sort by total edits
    return contributions.sort((a, b) => b.totalEdits - a.totalEdits);
  }

  /**
   * Get revision heatmap for a project
   */
  async getRevisionHeatmap(projectId: string): Promise<RevisionHeatmap[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: {
            blocks: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const heatmaps: RevisionHeatmap[] = [];

    for (let i = 0; i < project.slides.length; i++) {
      const slide = project.slides[i];

      // Get all edits for this slide
      const slideEdits = await this.prisma.activityLog.findMany({
        where: {
          targetId: slide.id,
          targetType: 'slide',
          action: { in: ['edit', 'update'] },
        },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Group by user
      const revisionsByUser: Record<string, number> = {};
      const revisionsByDay: Record<string, number> = {};

      for (const edit of slideEdits) {
        const userId = edit.userId;
        revisionsByUser[userId] = (revisionsByUser[userId] || 0) + 1;

        const day = edit.createdAt.toISOString().split('T')[0];
        revisionsByDay[day] = (revisionsByDay[day] || 0) + 1;
      }

      // Get block-level hotspots
      const hotspots: RevisionHeatmap['hotspots'] = [];

      for (const block of slide.blocks) {
        const blockEdits = await this.prisma.activityLog.findMany({
          where: {
            targetId: block.id,
            targetType: 'block',
            action: { in: ['edit', 'update'] },
          },
          include: {
            user: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });

        const blockEditCount = await this.prisma.activityLog.count({
          where: {
            targetId: block.id,
            targetType: 'block',
            action: { in: ['edit', 'update'] },
          },
        });

        if (blockEditCount > 0) {
          hotspots.push({
            blockId: block.id,
            revisionCount: blockEditCount,
            lastEditedBy: blockEdits[0]?.user?.name || 'Unknown',
            lastEditedAt: blockEdits[0]?.createdAt || block.updatedAt,
          });
        }
      }

      // Get slide title from first text block
      const titleBlock = slide.blocks.find(b => b.type === 'heading' || b.type === 'title');
      const slideTitle = titleBlock ? (titleBlock.content as any)?.text : undefined;

      heatmaps.push({
        slideId: slide.id,
        slideNumber: i + 1,
        slideTitle,
        totalRevisions: slideEdits.length,
        revisionsByUser,
        revisionsByDay,
        hotspots: hotspots.sort((a, b) => b.revisionCount - a.revisionCount),
      });
    }

    return heatmaps;
  }

  /**
   * Get activity timeline
   */
  async getActivityTimeline(
    organizationId: string,
    options?: {
      limit?: number;
      offset?: number;
      userId?: string;
      projectId?: string;
    },
  ): Promise<{ activities: ActivityTimeline[]; total: number }> {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const userIds = members.map(m => m.userId);

    const where: any = {
      userId: options?.userId ? options.userId : { in: userIds },
    };

    if (options?.projectId) {
      where.targetId = options.projectId;
      where.targetType = 'project';
    }

    const [activities, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      activities: activities.map(a => ({
        id: a.id,
        userId: a.userId,
        userName: a.user?.name || 'Unknown',
        action: a.action,
        target: a.targetType,
        targetId: a.targetId,
        metadata: a.metadata as Record<string, any>,
        timestamp: a.createdAt,
      })),
      total,
    };
  }

  /**
   * Get complete team dashboard
   */
  async getTeamDashboard(
    organizationId: string,
    period?: { start: Date; end: Date },
  ): Promise<TeamDashboard> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const defaultPeriod = period || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date(),
    };

    const [overallMetrics, allContributions, activityResult] = await Promise.all([
      this.getTeamPerformance(organizationId, defaultPeriod),
      this.getMemberContributions(organizationId, defaultPeriod),
      this.getActivityTimeline(organizationId, { limit: 20 }),
    ]);

    // Calculate productivity trends (daily)
    const productivityTrends = await this.getProductivityTrends(organizationId, defaultPeriod);

    return {
      organizationId,
      organizationName: organization.name,
      period: defaultPeriod,
      overallMetrics,
      topContributors: allContributions.slice(0, 10),
      recentActivity: activityResult.activities,
      productivityTrends,
    };
  }

  /**
   * Get productivity trends over time
   */
  async getProductivityTrends(
    organizationId: string,
    period: { start: Date; end: Date },
  ): Promise<TeamDashboard['productivityTrends']> {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const userIds = members.map(m => m.userId);

    const trends: TeamDashboard['productivityTrends'] = [];
    const current = new Date(period.start);

    while (current <= period.end) {
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      const [presentationsCreated, edits, collaborationSessions] = await Promise.all([
        this.prisma.project.count({
          where: {
            ownerId: { in: userIds },
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        this.prisma.activityLog.count({
          where: {
            userId: { in: userIds },
            action: { in: ['edit', 'update', 'create_slide', 'create_block'] },
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        this.prisma.collaborationSession.count({
          where: {
            project: { ownerId: { in: userIds } },
            startedAt: { gte: dayStart, lte: dayEnd },
          },
        }),
      ]);

      trends.push({
        date: current.toISOString().split('T')[0],
        presentationsCreated,
        edits,
        collaborationSessions,
      });

      current.setDate(current.getDate() + 1);
    }

    return trends;
  }

  /**
   * Track activity (called from other services)
   */
  async trackActivity(
    userId: string,
    action: string,
    targetType: string,
    targetId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        userId,
        action,
        targetType,
        targetId,
        metadata: metadata || {},
      },
    });
  }

  /**
   * Get attribution report for a project
   */
  async getProjectAttribution(projectId: string): Promise<{
    project: { id: string; title: string };
    contributors: Array<{
      userId: string;
      userName: string;
      contribution: {
        slidesCreated: number;
        blocksCreated: number;
        editsCount: number;
        firstContribution: Date;
        lastContribution: Date;
        percentageOfWork: number;
      };
    }>;
    timeline: ActivityTimeline[];
  }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: { blocks: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Get all activities for this project
    const allActivities = await this.prisma.activityLog.findMany({
      where: {
        OR: [
          { targetId: projectId, targetType: 'project' },
          { targetId: { in: project.slides.map(s => s.id) }, targetType: 'slide' },
          { targetId: { in: project.slides.flatMap(s => s.blocks.map(b => b.id)) }, targetType: 'block' },
        ],
      },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by user
    const userContributions: Record<string, {
      slidesCreated: Set<string>;
      blocksCreated: Set<string>;
      editsCount: number;
      firstContribution: Date;
      lastContribution: Date;
    }> = {};

    for (const activity of allActivities) {
      const userId = activity.userId;
      
      if (!userContributions[userId]) {
        userContributions[userId] = {
          slidesCreated: new Set(),
          blocksCreated: new Set(),
          editsCount: 0,
          firstContribution: activity.createdAt,
          lastContribution: activity.createdAt,
        };
      }

      const contrib = userContributions[userId];
      contrib.lastContribution = activity.createdAt;
      
      if (activity.action === 'create_slide' && activity.targetType === 'slide') {
        contrib.slidesCreated.add(activity.targetId);
      } else if (activity.action === 'create_block' && activity.targetType === 'block') {
        contrib.blocksCreated.add(activity.targetId);
      } else if (['edit', 'update'].includes(activity.action)) {
        contrib.editsCount++;
      }
    }

    // Calculate total work for percentage
    const totalWork = Object.values(userContributions).reduce(
      (acc, c) => acc + c.slidesCreated.size * 5 + c.blocksCreated.size * 2 + c.editsCount,
      0,
    );

    const contributors = await Promise.all(
      Object.entries(userContributions).map(async ([userId, contrib]) => {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });

        const workUnits = contrib.slidesCreated.size * 5 + contrib.blocksCreated.size * 2 + contrib.editsCount;

        return {
          userId,
          userName: user?.name || 'Unknown',
          contribution: {
            slidesCreated: contrib.slidesCreated.size,
            blocksCreated: contrib.blocksCreated.size,
            editsCount: contrib.editsCount,
            firstContribution: contrib.firstContribution,
            lastContribution: contrib.lastContribution,
            percentageOfWork: totalWork > 0 ? Math.round((workUnits / totalWork) * 100) : 0,
          },
        };
      }),
    );

    return {
      project: { id: project.id, title: project.title },
      contributors: contributors.sort((a, b) => b.contribution.percentageOfWork - a.contribution.percentageOfWork),
      timeline: allActivities.slice(-50).map(a => ({
        id: a.id,
        userId: a.userId,
        userName: a.user?.name || 'Unknown',
        action: a.action,
        target: a.targetType,
        targetId: a.targetId,
        metadata: a.metadata as Record<string, any>,
        timestamp: a.createdAt,
      })),
    };
  }
}
