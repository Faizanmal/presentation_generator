import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY')!,
      {
        apiVersion: '2026-01-28.clover',
      },
    );
  }

  /**
   * Create or get Stripe customer for user
   */
  async getOrCreateCustomer(userId: string): Promise<string> {
    const subscription = await this.usersService.getSubscription(userId);

    if (subscription.stripeCustomerId) {
      return subscription.stripeCustomerId;
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    try {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
        },
      });

      await this.usersService.updateSubscription(userId, {
        stripeCustomerId: customer.id,
      });

      this.logger.log(
        `Stripe customer created: ${customer.id} for user ${userId}`,
      );

      return customer.id;
    } catch (error) {
      this.logger.error('Failed to create Stripe customer', error);
      throw new InternalServerErrorException(
        'Failed to create payment profile',
      );
    }
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(userId: string, plan: 'pro' | 'enterprise') {
    const customerId = await this.getOrCreateCustomer(userId);

    const priceId =
      plan === 'pro'
        ? this.configService.get<string>('STRIPE_PRO_PRICE_ID')
        : this.configService.get<string>('STRIPE_ENTERPRISE_PRICE_ID');

    if (!priceId) {
      throw new BadRequestException('Invalid plan');
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${this.configService.get('FRONTEND_URL')}/dashboard?payment=success`,
        cancel_url: `${this.configService.get('FRONTEND_URL')}/dashboard?payment=cancelled`,
        metadata: {
          userId,
          plan,
        },
      });

      this.logger.log(
        `Checkout session created: ${session.id} for user ${userId}`,
      );

      return { url: session.url };
    } catch (error) {
      this.logger.error('Failed to create checkout session', error);
      throw new InternalServerErrorException(
        'Failed to create checkout session',
      );
    }
  }

  /**
   * Create customer portal session for managing subscription
   */
  async createPortalSession(userId: string) {
    const subscription = await this.usersService.getSubscription(userId);

    if (!subscription.stripeCustomerId) {
      throw new BadRequestException('No billing profile found');
    }

    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${this.configService.get('FRONTEND_URL')}/dashboard`,
      });

      return { url: session.url };
    } catch (error) {
      this.logger.error('Failed to create portal session', error);
      throw new InternalServerErrorException('Failed to access billing portal');
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(signature: string, payload: Buffer) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret!,
      );
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;

      default:
        this.logger.log(`Unhandled webhook event: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Handle successful checkout
   */
  private async handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan as 'pro' | 'enterprise';

    if (!userId || !plan) {
      this.logger.error('Missing metadata in checkout session');
      return;
    }

    // Get subscription details
    const subscription = await this.stripe.subscriptions.retrieve(
      session.subscription as string,
    );

    const planEnum =
      plan === 'pro' ? SubscriptionPlan.PRO : SubscriptionPlan.ENTERPRISE;

    await this.usersService.updateSubscription(userId, {
      plan: planEnum,
      status: SubscriptionStatus.ACTIVE,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      currentPeriodStart: new Date(
        (subscription as unknown as { current_period_start: number })
          .current_period_start * 1000,
      ),
      currentPeriodEnd: new Date(
        (subscription as unknown as { current_period_end: number })
          .current_period_end * 1000,
      ),
      projectsLimit: plan === 'enterprise' ? 1000 : 50,
      aiGenerationsLimit: plan === 'enterprise' ? 10000 : 500,
    });

    this.logger.log(`Subscription activated: ${userId} -> ${plan}`);
  }

  /**
   * Handle subscription updates
   */
  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const userSubscription = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!userSubscription) {
      this.logger.warn(`No user found for customer: ${customerId}`);
      return;
    }

    let status: SubscriptionStatus;
    switch (subscription.status) {
      case 'active':
        status = SubscriptionStatus.ACTIVE;
        break;
      case 'past_due':
        status = SubscriptionStatus.PAST_DUE;
        break;
      case 'canceled':
        status = SubscriptionStatus.CANCELED;
        break;
      case 'trialing':
        status = SubscriptionStatus.TRIALING;
        break;
      default:
        status = SubscriptionStatus.ACTIVE;
    }

    await this.usersService.updateSubscription(userSubscription.userId, {
      status,
      currentPeriodStart: new Date(
        (subscription as unknown as { current_period_start: number })
          .current_period_start * 1000,
      ),
      currentPeriodEnd: new Date(
        (subscription as unknown as { current_period_end: number })
          .current_period_end * 1000,
      ),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    // Reset AI generations on new billing period
    if (subscription.status === 'active') {
      await this.usersService.resetAIGenerations(userSubscription.userId);
    }

    this.logger.log(
      `Subscription updated: ${userSubscription.userId} -> ${status}`,
    );
  }

  /**
   * Handle subscription cancellation
   */
  private async handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    const userSubscription = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!userSubscription) {
      return;
    }

    // Downgrade to free plan
    await this.usersService.updateSubscription(userSubscription.userId, {
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.CANCELED,
      stripeSubscriptionId: undefined,
      stripePriceId: undefined,
      projectsLimit: 3,
      aiGenerationsLimit: 10,
    });

    this.logger.log(`Subscription canceled: ${userSubscription.userId}`);
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;

    const userSubscription = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!userSubscription) {
      return;
    }

    await this.usersService.updateSubscription(userSubscription.userId, {
      status: SubscriptionStatus.PAST_DUE,
    });

    this.logger.warn(`Payment failed for user: ${userSubscription.userId}`);
  }

  /**
   * Get subscription details from Stripe
   */
  async getStripeSubscription(
    userId: string,
  ): Promise<Stripe.Subscription | null> {
    const subscription = await this.usersService.getSubscription(userId);

    if (!subscription.stripeSubscriptionId) {
      return null;
    }

    try {
      return await this.stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
      );
    } catch (error) {
      this.logger.error('Failed to retrieve Stripe subscription', error);
      return null;
    }
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(userId: string) {
    const subscription = await this.usersService.getSubscription(userId);

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription');
    }

    try {
      await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        },
      );

      await this.usersService.updateSubscription(userId, {
        cancelAtPeriodEnd: true,
      });

      this.logger.log(`Subscription marked for cancellation: ${userId}`);

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to cancel subscription', error);
      throw new InternalServerErrorException('Failed to cancel subscription');
    }
  }

  /**
   * Resume a canceled subscription
   */
  async resumeSubscription(userId: string) {
    const subscription = await this.usersService.getSubscription(userId);

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException('No subscription to resume');
    }

    try {
      await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: false,
        },
      );

      await this.usersService.updateSubscription(userId, {
        cancelAtPeriodEnd: false,
      });

      this.logger.log(`Subscription resumed: ${userId}`);

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to resume subscription', error);
      throw new InternalServerErrorException('Failed to resume subscription');
    }
  }
}
