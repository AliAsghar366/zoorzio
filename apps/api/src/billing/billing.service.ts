import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private prisma: PrismaService,
    private plansService: PlansService,
    private configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = secretKey ? new Stripe(secretKey, { apiVersion: '2023-10-16' }) : null;
  }

  /** True once a real Stripe merchant account has been wired up via STRIPE_SECRET_KEY. */
  get isLive(): boolean {
    return this.stripe !== null;
  }

  async getSubscription(userId: string) {
    return this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
  }

  /**
   * Starts a subscription for the given plan. With a real Stripe key
   * configured this creates a Checkout Session and returns its URL for the
   * client to redirect to. Without one (no merchant account yet), it
   * activates the subscription immediately in "demo mode" so the rest of
   * the product can be built and tested end-to-end ahead of Stripe being
   * connected.
   */
  async checkout(userId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException('Plan not found');
    }

    if (this.stripe) {
      if (!plan.stripePriceId) {
        throw new BadRequestException('This plan is not yet linked to a Stripe price');
      }

      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const existing = await this.getSubscription(userId);

      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: existing?.stripeCustomerId ? undefined : user.email,
        customer: existing?.stripeCustomerId || undefined,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: this.configService.get('STRIPE_SUCCESS_URL', 'http://localhost:3000/settings?billing=success'),
        cancel_url: this.configService.get('STRIPE_CANCEL_URL', 'http://localhost:3000/pricing'),
        metadata: { userId, planId },
      });

      return { mode: 'live' as const, checkoutUrl: session.url };
    }

    // Demo mode: no Stripe merchant account configured yet.
    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      update: { planId, status: 'ACTIVE' },
      create: { userId, planId, status: 'ACTIVE' },
      include: { plan: true },
    });

    this.logger.log(`Demo-mode subscribe: user ${userId} -> plan ${plan.slug}`);
    return { mode: 'demo' as const, subscription };
  }

  async cancel(userId: string) {
    const subscription = await this.getSubscription(userId);
    if (!subscription) {
      throw new NotFoundException('No active subscription');
    }

    if (this.stripe && subscription.stripeSubscriptionId) {
      await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    }

    return this.prisma.subscription.update({
      where: { userId },
      data: { status: 'CANCELED' },
      include: { plan: true },
    });
  }

  /**
   * Verifies and applies a Stripe webhook event. Until STRIPE_WEBHOOK_SECRET
   * is configured (i.e. no merchant account yet), this is a no-op stub.
   */
  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<{ received: boolean }> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!this.stripe || !webhookSecret) {
      this.logger.warn('Received Stripe webhook but Stripe is not configured yet - ignoring');
      return { received: true };
    }

    const event = this.stripe.webhooks.constructEvent(rawBody, signature || '', webhookSecret);

    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          await this.prisma.subscription.updateMany({
            where: { userId },
            data: {
              status: sub.status === 'active' ? 'ACTIVE' : sub.status === 'past_due' ? 'PAST_DUE' : 'CANCELED',
              stripeSubscriptionId: sub.id,
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            },
          });
        }
        break;
      }
      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return { received: true };
  }
}
