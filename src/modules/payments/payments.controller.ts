import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AspiranteOnlyGuard } from '../auth/guards/aspirante-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayloadAspirante } from '../../common/interfaces/jwt-payload.interface';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentResponseDto } from './dto/create-payment-intent-response.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { ConfirmPaymentResponseDto } from './dto/confirm-payment-response.dto';

@ApiTags('payments')
@Controller('payments')
@UseGuards(AspiranteOnlyGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Iniciar pago: publishableKey, returnUrl, clientSecret, requestThreeDSecure, billingDefaults y PaymentIntent (2000 MXN). Solo si evaluationFlowOrderId = 2.',
  })
  @ApiOkResponse({ type: CreatePaymentIntentResponseDto })
  @ApiConflictResponse({ description: 'El aspirante ya pagó' })
  @ApiResponse({ status: 400, description: 'No está en el paso de pago' })
  createPaymentIntent(
    @CurrentUser() user: JwtPayloadAspirante,
  ): Promise<CreatePaymentIntentResponseDto> {
    return this.paymentsService.createPaymentIntent(user);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Confirmar pago exitoso y obtener JWT actualizado (paso Pagado). Idempotente con webhook.',
  })
  @ApiOkResponse({ type: ConfirmPaymentResponseDto })
  @ApiResponse({ status: 400, description: 'Pago no completado o no corresponde al aspirante' })
  confirmPayment(
    @CurrentUser() user: JwtPayloadAspirante,
    @Body() dto: ConfirmPaymentDto,
  ): Promise<ConfirmPaymentResponseDto> {
    return this.paymentsService.confirmPayment(user, dto.paymentIntentId);
  }
}
