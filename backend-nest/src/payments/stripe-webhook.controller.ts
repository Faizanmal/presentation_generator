import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, RawBodyRequest } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('webhooks')
export class StripeWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Handle Stripe webhook events
   * This endpoint must receive raw body for signature verification
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new Error('Missing raw body');
    }

    return this.paymentsService.handleWebhook(signature, rawBody);
  }
}
