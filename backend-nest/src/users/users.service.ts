import { Injectable, NotFoundException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find user by ID
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        subscription: true,
      },
    });
    return user;
  }

  /**
   * Find user by email (excludes soft-deleted accounts)
   */
  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email },
      include: {
        subscription: true,
      },
    });
  }

  /**
   * Find user by phone number
   */
  async findByPhone(phone: string) {
    // Normalize phone number (remove non-digit characters except +)
    const normalizedPhone = phone.replace(/[^\d+]/g, '');
    return this.prisma.user.findFirst({
      where: { phone: normalizedPhone },
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
   * Delete a user account
   */
  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
    this.logger.warn(`User deleted: ${id}`);
  }

  /**
   * Reactivate a soft-deleted user account
   */


  /**
   * Calculate profile completeness as a percentage (0–100)
   */
  async getProfileCompleteness(
    userId: string,
  ): Promise<{ score: number; missing: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const fields: Array<{ key: keyof typeof user; label: string }> = [
      { key: 'name', label: 'Display name' },
      { key: 'image', label: 'Profile picture' },
      { key: 'phone', label: 'Phone number' },
    ];

    const missing: string[] = [];
    for (const f of fields) {
      if (!user[f.key]) missing.push(f.label);
    }

    const score = Math.round(
      ((fields.length - missing.length) / fields.length) * 100,
    );
    return { score, missing };
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
   * PRO/ENTERPRISE users have unlimited generations.
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
      where: { ownerId: userId, deletedAt: null },
    });

    return projectCount < subscription.projectsLimit;
  }

  /**
   * Get email preferences for user
   */
  async getEmailPreferences(userId: string) {
    const preferences = await this.prisma.emailPreferences.findUnique({
      where: { userId },
    });

    // Return defaults if no preferences exist
    if (!preferences) {
      return {
        loginOtp: true,
        passwordReset: true,
        marketingEmails: false,
        projectUpdates: true,
        securityAlerts: true,
        productUpdates: false,
      };
    }

    return {
      loginOtp: preferences.loginOtp,
      passwordReset: preferences.passwordReset,
      marketingEmails: preferences.marketingEmails,
      projectUpdates: preferences.projectUpdates,
      securityAlerts: preferences.securityAlerts,
      productUpdates: preferences.productUpdates,
    };
  }

  /**
   * Update email preferences for user
   */
  async updateEmailPreferences(
    userId: string,
    data: {
      loginOtp?: boolean;
      passwordReset?: boolean;
      marketingEmails?: boolean;
      projectUpdates?: boolean;
      securityAlerts?: boolean;
      productUpdates?: boolean;
    },
  ) {
    // Ensure required preferences stay enabled
    const updateData = {
      ...data,
      loginOtp: true, // Always required
      passwordReset: true, // Always required
    };

    const preferences = await this.prisma.emailPreferences.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData,
      },
    });

    return {
      loginOtp: preferences.loginOtp,
      passwordReset: preferences.passwordReset,
      marketingEmails: preferences.marketingEmails,
      projectUpdates: preferences.projectUpdates,
      securityAlerts: preferences.securityAlerts,
      productUpdates: preferences.productUpdates,
    };
  }
}
