import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
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
  async createLearningPath(creatorId: string, data: {
    title: string;
    description?: string;
    category?: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    projectIds: string[];
    isPublic?: boolean;
  }) {
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
        creatorId,
        title: data.title,
        description: data.description,
        category: data.category,
        difficulty: data.difficulty,
        isPublic: data.isPublic ?? false,
        totalModules: data.projectIds.length,
        estimatedHours: Math.ceil(data.projectIds.length * 0.5),
      },
    });

    // Create modules from projects
    for (let i = 0; i < data.projectIds.length; i++) {
      const project = projects.find(p => p.id === data.projectIds[i])!;
      
      await this.prisma.learningModule.create({
        data: {
          pathId: learningPath.id,
          title: project.title,
          description: project.description,
          order: i + 1,
          contentType: 'presentation',
          contentId: project.id,
          estimatedMinutes: 30,
        },
      });
    }

    return this.getLearningPath(learningPath.id);
  }

  /**
   * Generate AI-powered learning path from topic
   */
  async generateLearningPath(creatorId: string, topic: string, options?: {
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    duration?: 'short' | 'medium' | 'long';
  }) {
    const difficulty = options?.difficulty || 'beginner';
    const moduleCount = options?.duration === 'short' ? 3 : options?.duration === 'long' ? 8 : 5;

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
        { maxTokens: 500 }
      );

      let modules: Array<{ title: string; description: string; concepts: string[] }> = [];
      try {
        modules = JSON.parse(structure);
      } catch {
        // Fallback structure
        modules = [
          { title: `Introduction to ${topic}`, description: 'Get started with the basics', concepts: ['Overview', 'Key terms'] },
          { title: `${topic} Fundamentals`, description: 'Core concepts and principles', concepts: ['Fundamentals'] },
          { title: `Advanced ${topic}`, description: 'Deep dive into advanced topics', concepts: ['Advanced'] },
        ];
      }

      // Create the learning path
      const learningPath = await this.prisma.learningPath.create({
        data: {
          creatorId,
          title: `Learn ${topic}`,
          description: `A comprehensive ${difficulty}-level course on ${topic}`,
          category: 'AI Generated',
          difficulty,
          isPublic: false,
          totalModules: modules.length,
          estimatedHours: Math.ceil(modules.length * 0.5),
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
            contentType: 'generated',
            content: { concepts: modules[i].concepts },
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
      where: { pathId, learnerId },
    });

    if (existing) {
      throw new BadRequestException('Already enrolled');
    }

    return this.prisma.learnerProgress.create({
      data: {
        pathId,
        learnerId,
        status: 'in_progress',
        completedModules: [],
        progressPercentage: 0,
      },
    });
  }

  /**
   * Update learner progress
   */
  async updateProgress(pathId: string, learnerId: string, update: ProgressUpdate) {
    const progress = await this.prisma.learnerProgress.findFirst({
      where: { pathId, learnerId },
    });

    if (!progress) {
      throw new NotFoundException('Enrollment not found');
    }

    const path = await this.getLearningPath(pathId);
    const completedModules = (progress.completedModules as string[]) || [];

    if (update.completed && !completedModules.includes(update.moduleId)) {
      completedModules.push(update.moduleId);
    }

    const progressPercentage = Math.round(
      (completedModules.length / path.totalModules) * 100
    );

    const status = progressPercentage >= 100 ? 'completed' : 'in_progress';

    // Update time spent
    const currentTimeSpent = progress.timeSpent || 0;
    const newTimeSpent = currentTimeSpent + (update.timeSpent || 0);

    return this.prisma.learnerProgress.update({
      where: { id: progress.id },
      data: {
        completedModules,
        progressPercentage,
        status,
        timeSpent: newTimeSpent,
        lastModuleId: update.moduleId,
        completedAt: status === 'completed' ? new Date() : null,
      },
    });
  }

  /**
   * Get learner's progress
   */
  async getLearnerProgress(pathId: string, learnerId: string) {
    const progress = await this.prisma.learnerProgress.findFirst({
      where: { pathId, learnerId },
    });

    if (!progress) {
      return null;
    }

    const path = await this.getLearningPath(pathId);

    return {
      ...progress,
      path,
      nextModule: this.getNextModule(path.modules, progress.completedModules as string[]),
    };
  }

  /**
   * Get next module to complete
   */
  private getNextModule(modules: Array<{ id: string; order: number }>, completed: string[]) {
    return modules.find(m => !completed.includes(m.id)) || null;
  }

  /**
   * Get personalized recommendations
   */
  async getRecommendations(learnerId: string) {
    // Get learner's completed paths
    const completedPaths = await this.prisma.learnerProgress.findMany({
      where: { learnerId, status: 'completed' },
      include: { path: true },
    });

    // Get public paths learner hasn't enrolled in
    const enrolledPathIds = await this.prisma.learnerProgress.findMany({
      where: { learnerId },
      select: { pathId: true },
    });

    const recommendations = await this.prisma.learningPath.findMany({
      where: {
        isPublic: true,
        id: { notIn: enrolledPathIds.map(e => e.pathId) },
      },
      take: 5,
      orderBy: { enrollments: 'desc' },
    });

    // Add AI-based recommendation context
    if (completedPaths.length > 0) {
      const categories = completedPaths.map(p => p.path.category).filter(Boolean);
      // Could enhance with AI-based category matching
    }

    return recommendations;
  }

  /**
   * Get learner's dashboard
   */
  async getLearnerDashboard(learnerId: string) {
    const [inProgress, completed, totalTime] = await Promise.all([
      this.prisma.learnerProgress.findMany({
        where: { learnerId, status: 'in_progress' },
        include: { path: true },
        take: 5,
      }),
      this.prisma.learnerProgress.count({
        where: { learnerId, status: 'completed' },
      }),
      this.prisma.learnerProgress.aggregate({
        where: { learnerId },
        _sum: { timeSpent: true },
      }),
    ]);

    const recommendations = await this.getRecommendations(learnerId);

    return {
      inProgress,
      completedCount: completed,
      totalTimeMinutes: totalTime._sum.timeSpent || 0,
      recommendations,
    };
  }

  /**
   * Add quiz to module
   */
  async addQuizToModule(moduleId: string, creatorId: string, quiz: {
    question: string;
    options: string[];
    correctIndex: number;
  }) {
    const module = await this.prisma.learningModule.findUnique({
      where: { id: moduleId },
      include: { path: true },
    });

    if (!module || module.path.creatorId !== creatorId) {
      throw new BadRequestException('Module not found or unauthorized');
    }

    const content = (module.content as { quizzes?: object[] }) || {};
    const quizzes = content.quizzes || [];
    quizzes.push(quiz);

    return this.prisma.learningModule.update({
      where: { id: moduleId },
      data: {
        content: { ...content, quizzes },
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

    return {
      certificateId: `CERT-${pathId.substring(0, 8)}-${learnerId.substring(0, 8)}`,
      pathTitle: progress.path.title,
      learnerName: learner?.name || 'Learner',
      completedAt: progress.completedAt,
      totalHours: Math.round((progress.timeSpent || 0) / 60),
      modulesCompleted: progress.path.totalModules,
    };
  }

  /**
   * Get public learning paths
   */
  async getPublicPaths(options?: { category?: string; difficulty?: string; limit?: number }) {
    return this.prisma.learningPath.findMany({
      where: {
        isPublic: true,
        ...(options?.category && { category: options.category }),
        ...(options?.difficulty && { difficulty: options.difficulty }),
      },
      take: options?.limit || 20,
      orderBy: { enrollments: 'desc' },
      include: {
        _count: {
          select: { modules: true },
        },
      },
    });
  }
}
