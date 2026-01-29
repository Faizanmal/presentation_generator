import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

interface CreateUserDto {
  email: string;
  name?: string;
  password?: string;
  image?: string;
}

interface CreateAccountDto {
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Find user by ID
   */
  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        subscription: true,
      },
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        subscription: true,
      },
    });
  }

  /**
   * Create a new user
   */
  async create(data: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: data.password,
        image: data.image,
      },
      include: {
        subscription: true,
      },
    });
  }

  /**
   * Update user profile
   */
  async update(id: string, data: Partial<CreateUserDto>) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Create an OAuth account link
   */
  async createAccount(data: CreateAccountDto) {
    return this.prisma.account.create({
      data: {
        userId: data.userId,
        type: data.type,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
      },
    });
  }

  /**
   * Find account by user and provider
   */
  async findAccount(userId: string, provider: string) {
    return this.prisma.account.findFirst({
      where: {
        userId,
        provider,
      },
    });
  }

  /**
   * Create subscription for user
   */
  async createSubscription(userId: string) {
    return this.prisma.subscription.create({
      data: {
        userId,
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        projectsLimit: 3,
        aiGenerationsLimit: 10,
      },
    });
  }

  /**
   * Get user subscription
   */
  async getSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Calculate projects used
    const projectsUsed = await this.prisma.project.count({
      where: { ownerId: userId },
    });

    return {
      ...subscription,
      projectsUsed,
    };
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    userId: string,
    data: {
      plan?: SubscriptionPlan;
      status?: SubscriptionStatus;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      stripePriceId?: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAtPeriodEnd?: boolean;
      projectsLimit?: number;
      aiGenerationsLimit?: number;
    },
  ) {
    return this.prisma.subscription.update({
      where: { userId },
      data,
    });
  }

  /**
   * Increment AI generations used
   */
  async incrementAIGenerations(userId: string, count: number = 1) {
    return this.prisma.subscription.update({
      where: { userId },
      data: {
        aiGenerationsUsed: { increment: count },
      },
    });
  }

  /**
   * Reset AI generations (for new billing period)
   */
  async resetAIGenerations(userId: string) {
    return this.prisma.subscription.update({
      where: { userId },
      data: {
        aiGenerationsUsed: 0,
      },
    });
  }

  /**
   * Check if user can generate AI content
   */
  async canGenerateAI(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);

    if (
      subscription.plan === SubscriptionPlan.PRO ||
      subscription.plan === SubscriptionPlan.ENTERPRISE
    ) {
      return true;
    }

    return subscription.aiGenerationsUsed < subscription.aiGenerationsLimit;
  }

  /**
   * Check if user can create more projects
   */
  async canCreateProject(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);

    if (
      subscription.plan === SubscriptionPlan.PRO ||
      subscription.plan === SubscriptionPlan.ENTERPRISE
    ) {
      return true;
    }

    const projectCount = await this.prisma.project.count({
      where: { ownerId: userId },
    });

    return projectCount < subscription.projectsLimit;
  }
}
