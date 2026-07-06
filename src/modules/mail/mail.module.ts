import { Module } from '@nestjs/common';
import { BrevoClient } from './brevo.client';
import { MailService } from './mail.service';

@Module({
  providers: [BrevoClient, MailService],
  exports: [MailService],
})
export class MailModule {}
