import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';

interface ModuleContent {
  slides: string[];
  quizzes?: Array<{ question: string; options: string[]; correct: number }>;
  resources?: string[];
  estimatedTime: number;
}

interface ProgressUpdate {
  moduleId: string;
  completed: boolean;
  score?: number;
  timeSpent?: number;
}

@Injectable()
export class LearningPathsService {
  private readonly logger = new Logger(LearningPathsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Create a learning path from presentations
   */
  async createLearningPath(
    creatorId: string,
    data: {
      title: string;
      description?: string;
      category?: string;
      difficulty: 'beginner' | 'intermediate' | 'advanced';
      projectIds: string[];
      isPublic?: boolean;
    },
  ) {
    // Verify projects exist and user has access
    const projects = await this.prisma.project.findMany({
      where: {
        id: { in: data.projectIds },
        ownerId: creatorId,
      },
    });

    if (projects.length !== data.projectIds.length) {
      throw new BadRequestException('Some projects not found or inaccessible');
    }

    // Create learning path
    const learningPath = await this.prisma.learningPath.create({
      data: {
        userId: creatorId,
        projectId: data.projectIds[0], // Use first project as main project
        title: data.title,
        description: data.description,
        category: data.category,
        difficulty: data.difficulty,
        isPublished: data.isPublic ?? false,
        estimatedTime: data.projectIds.length * 30, // minutes
      },
    });

    // Create modules from projects
    for (let i = 0; i < data.projectIds.length; i++) {
      const project = projects.find((p) => p.id === data.projectIds[i])!;

      await this.prisma.learningModule.create({
        data: {
          pathId: learningPath.id,
          title: project.title,
          description: project.description,
          order: i + 1,
          type: 'presentation',
          // store project reference in the free-form content JSON
          content: JSON.stringify({ projectId: project.id }),
          estimatedMinutes: 30,
        },
      });
    }

    return this.getLearningPath(learningPath.id);
  }

  /**
   * Generate AI-powered learning path from topic
   */
  async generateLearningPath(
    creatorId: string,
    topic: string,
    options?: {
      difficulty?: 'beginner' | 'intermediate' | 'advanced';
      duration?: 'short' | 'medium' | 'long';
    },
  ) {
    const difficulty = options?.difficulty || 'beginner';
    const moduleCount =
      options?.duration === 'short' ? 3 : options?.duration === 'long' ? 8 : 5;

    try {
      const structure = await this.aiService.generateText(
        `Create a ${moduleCount}-module learning path for: "${topic}"
Difficulty: ${difficulty}

For each module, provide:
1. Title
2. Brief description (1 sentence)
3. Key concepts (3-5 items)

Format as JSON array:
[{"title": "...", "description": "...", "concepts": ["concept1", "concept2"]}]`,
        { maxTokens: 500 },
      );

      let modules: Array<{
        title: string;
        description: string;
        concepts: string[];
      }> = [];
      try {
        modules = JSON.parse(structure);
      } catch {
        // Fallback structure
        modules = [
          {
            title: `Introduction to ${topic}`,
            description: 'Get started with the basics',
            concepts: ['Overview', 'Key terms'],
          },
          {
            title: `${topic} Fundamentals`,
            description: 'Core concepts and principles',
            concepts: ['Fundamentals'],
          },
          {
            title: `Advanced ${topic}`,
            description: 'Deep dive into advanced topics',
            concepts: ['Advanced'],
          },
        ];
      }

      // Create the learning path
      const learningPath = await this.prisma.learningPath.create({
        data: {
          userId: creatorId,
          title: `Learn ${topic}`,
          description: `A comprehensive ${difficulty}-level course on ${topic}`,
          category: 'AI Generated',
          difficulty,
          isPublished: false,
          estimatedTime: modules.length * 25, // minutes
        },
      });

      // Create modules
      for (let i = 0; i < modules.length; i++) {
        await this.prisma.learningModule.create({
          data: {
            pathId: learningPath.id,
            title: modules[i].title,
            description: modules[i].description,
            order: i + 1,
            type: 'generated',
            content: JSON.stringify({ concepts: modules[i].concepts }),
            estimatedMinutes: 25,
          },
        });
      }

      return this.getLearningPath(learningPath.id);
    } catch (error) {
      this.logger.error('Failed to generate learning path', error);
      throw new BadRequestException('Failed to generate learning path');
    }
  }

  /**
   * Get learning path with modules
   */
  async getLearningPath(id: string) {
    const path = await this.prisma.learningPath.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!path) {
      throw new NotFoundException('Learning path not found');
    }

    return path;
  }

  /**
   * Enroll learner in path
   */
  async enrollLearner(pathId: string, learnerId: string) {
    const path = await this.getLearningPath(pathId);

    const existing = await this.prisma.learnerProgress.findFirst({
      where: { pathId, userId: learnerId },
    });

    if (existing) {
      throw new BadRequestException('Already enrolled');
    }

    // Create progress records for each module
    const progressRecords = path.modules.map((module) => ({
      pathId,
      userId: learnerId,
      moduleId: module.id,
      status: 'not_started',
      progress: 0,
    }));

    return this.prisma.learnerProgress.createMany({
      data: progressRecords,
    });
  }

  /**
   * Update learner progress
   */
  async updateProgress(
    pathId: string,
    learnerId: string,
    update: ProgressUpdate,
  ) {
    const progress = await this.prisma.learnerProgress.findFirst({
      where: { pathId, userId: learnerId, moduleId: update.moduleId },
    });

    if (!progress) {
      throw new NotFoundException('Progress record not found');
    }

    const status = update.completed ? 'completed' : 'in_progress';
    const progressValue = update.completed
      ? 100
      : Math.max(progress.progress, 50); // Assume 50% if in progress

    return this.prisma.learnerProgress.update({
      where: { id: progress.id },
      data: {
        status,
        progress: progressValue,
        quizScore: update.score,
        timeSpent: { increment: update.timeSpent || 0 },
        attempts: { increment: 1 },
        lastAccessedAt: new Date(),
        completedAt: update.completed ? new Date() : null,
      },
    });
  }

  /**
   * Get learner's progress
   */
  async getLearnerProgress(pathId: string, learnerId: string) {
    const progressRecords = await this.prisma.learnerProgress.findMany({
      where: { pathId, userId: learnerId },
      include: { module: true },
    });

    if (progressRecords.length === 0) {
      return null;
    }

    const path = await this.getLearningPath(pathId);
    const completedModules = progressRecords
      .filter((p) => p.status === 'completed')
      .map((p) => p.moduleId);
    const totalProgress =
      progressRecords.reduce((sum, p) => sum + p.progress, 0) /
      progressRecords.length;
    const totalTimeSpent = progressRecords.reduce(
      (sum, p) => sum + p.timeSpent,
      0,
    );
    const status =
      totalProgress >= 100
        ? 'completed'
        : totalProgress > 0
          ? 'in_progress'
          : 'not_started';

    return {
      pathId,
      userId: learnerId,
      status,
      progress: Math.round(totalProgress),
      completedModules,
      timeSpent: totalTimeSpent,
      path,
      nextModule: this.getNextModule(path.modules, completedModules),
    };
  }

  /**
   * Get next module to complete
   */
  private getNextModule(
    modules: Array<{ id: string; order: number }>,
    completed: string[],
  ) {
    return modules.find((m) => !completed.includes(m.id)) || null;
  }

  /**
   * Get personalized recommendations
   */
  async getRecommendations(learnerId: string) {
    // Get learner's completed paths
    const completedProgress = await this.prisma.learnerProgress.findMany({
      where: { userId: learnerId, status: 'completed' },
      include: { module: { include: { path: true } } },
    });

    const completedPathIds = [
      ...new Set(completedProgress.map((p) => p.pathId)),
    ];

    // Get public paths learner hasn't enrolled in
    const enrolledPathIds = await this.prisma.learnerProgress.findMany({
      where: { userId: learnerId },
      select: { pathId: true },
    });

    const enrolledIds = [...new Set(enrolledPathIds.map((e) => e.pathId))];

    const recommendations = await this.prisma.learningPath.findMany({
      where: {
        isPublished: true,
        id: { notIn: enrolledIds },
      },
      take: 5,
      orderBy: { completionRate: 'desc' },
    });

    // Add AI-based recommendation context
    if (completedPathIds.length > 0) {
      const categories = completedProgress
        .map((p) => p.module.path.category)
        .filter(Boolean);
      // Could enhance with AI-based category matching
    }

    return recommendations;
  }

  /**
   * Get learner's dashboard
   */
  async getLearnerDashboard(learnerId: string) {
    // Get in-progress paths
    const inProgressRecords = await this.prisma.learnerProgress.findMany({
      where: { userId: learnerId, status: 'in_progress' },
      include: { module: { include: { path: true } } },
    });

    const inProgressPathIds = [
      ...new Set(inProgressRecords.map((p) => p.pathId)),
    ];
    const inProgress = await this.prisma.learningPath.findMany({
      where: { id: { in: inProgressPathIds } },
      take: 5,
    });

    const [completed, totalTime] = await Promise.all([
      this.prisma.learnerProgress.count({
        where: { userId: learnerId, status: 'completed' },
      }),
      this.prisma.learnerProgress.aggregate({
        where: { userId: learnerId },
        _sum: { timeSpent: true },
      }),
    ]);

    const recommendations = await this.getRecommendations(learnerId);

    return {
      inProgress,
      completedCount: completed,
      totalTimeMinutes: totalTime._sum?.timeSpent ?? 0,
      recommendations,
    };
  }

  /**
   * Add quiz to module
   */
  async addQuizToModule(
    moduleId: string,
    creatorId: string,
    quiz: {
      question: string;
      options: string[];
      correctIndex: number;
    },
  ) {
    const module = await this.prisma.learningModule.findUnique({
      where: { id: moduleId },
      include: { path: true },
    });

    if (!module || module.path.userId !== creatorId) {
      throw new BadRequestException('Module not found or unauthorized');
    }

    // module.content is stored as a JSON string (or plain text). Parse if possible.
    let contentObj: { quizzes?: any[]; text?: string } = {};
    if (typeof module.content === 'string' && module.content.trim()) {
      try {
        contentObj = JSON.parse(module.content);
      } catch {
        // legacy plain-text content - preserve as `text` field
        contentObj = { text: module.content };
      }
    }

    const quizzes = contentObj.quizzes || [];
    quizzes.push(quiz);

    return this.prisma.learningModule.update({
      where: { id: moduleId },
      data: {
        content: JSON.stringify({ ...contentObj, quizzes }),
      },
    });
  }

  /**
   * Generate certificate for completed path
   */
  async generateCertificate(pathId: string, learnerId: string) {
    const progress = await this.getLearnerProgress(pathId, learnerId);

    if (!progress || progress.status !== 'completed') {
      throw new BadRequestException('Path not completed');
    }

    const learner = await this.prisma.user.findUnique({
      where: { id: learnerId },
    });

    // Find the latest completion date
    const latestCompletion = await this.prisma.learnerProgress.findFirst({
      where: { pathId, userId: learnerId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
    });

    return {
      certificateId: `CERT-${pathId.substring(0, 8)}-${learnerId.substring(0, 8)}`,
      pathTitle: progress.path.title,
      learnerName: learner?.name || 'Learner',
      completedAt: latestCompletion?.completedAt,
      totalHours: Math.round((progress.timeSpent || 0) / 3600), // Convert seconds to hours
      modulesCompleted: progress.completedModules.length,
    };
  }

  /**
   * Get public learning paths
   */
  async getPublicPaths(options?: {
    category?: string;
    difficulty?: string;
    limit?: number;
  }) {
    return this.prisma.learningPath.findMany({
      where: {
        isPublished: true,
        ...(options?.category && { category: options.category }),
        ...(options?.difficulty && { difficulty: options.difficulty }),
      },
      take: options?.limit || 20,
      orderBy: { completionRate: 'desc' },
      include: {
        _count: {
          select: { modules: true },
        },
      },
    });
  }
}
