import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AspiranteModule } from '../aspirante/aspirante.module';
import { Aspirante } from '../aspirante/aspirante.entity';
import { Hospital } from '../hospital/hospital.entity';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Aspirante, Hospital]),
    AuthModule,
    AspiranteModule,
  ],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
