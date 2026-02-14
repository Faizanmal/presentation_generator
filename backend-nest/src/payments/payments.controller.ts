import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ThrottlePayment,
  ThrottleModerate,
} from '../common/decorators/throttle.decorator';

class CreateCheckoutDto {
  plan: 'pro' | 'enterprise';
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Create checkout session for subscription
   */
  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ThrottlePayment()
  async createCheckout(
    @CurrentUser() user: { id: string },
    @Body() body: CreateCheckoutDto,
  ) {
    return this.paymentsService.createCheckoutSession(user.id, body.plan);
  }

  /**
   * Create customer portal session
   */
  @Post('portal')
  @HttpCode(HttpStatus.OK)
  @ThrottleModerate()
  async createPortal(@CurrentUser() user: { id: string }) {
    return this.paymentsService.createPortalSession(user.id);
  }

  /**
   * Get current subscription details
   */
  @Get('subscription')
  async getSubscription(@CurrentUser() user: { id: string }) {
    return this.paymentsService.getStripeSubscription(user.id);
  }

  /**
   * Cancel subscription
   */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ThrottlePayment()
  async cancelSubscription(@CurrentUser() user: { id: string }) {
    return this.paymentsService.cancelSubscription(user.id);
  }

  /**
   * Resume canceled subscription
   */
  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ThrottlePayment()
  async resumeSubscription(@CurrentUser() user: { id: string }) {
    return this.paymentsService.resumeSubscription(user.id);
  }
}
