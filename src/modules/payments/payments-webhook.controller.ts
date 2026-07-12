import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';

@ApiExcludeController()
@Controller('webhooks')
export class PaymentsWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody ?? (req.body as Buffer);
    await this.paymentsService.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
