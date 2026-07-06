import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as brevo from '@getbrevo/brevo';

export interface BrevoSender {
  email: string;
  name?: string;
}

export interface BrevoRecipient {
  email: string;
  name?: string;
}

export interface SendTransactionalParams {
  sender: BrevoSender;
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

@Injectable()
export class BrevoClient {
  private readonly api: brevo.TransactionalEmailsApi | null;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY', '');
    if (apiKey) {
      this.api = new brevo.TransactionalEmailsApi();
      this.api.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
      this.enabled = true;
    } else {
      this.api = null;
      this.enabled = false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async sendTransactional(params: SendTransactionalParams): Promise<void> {
    if (!this.api) {
      throw new Error('Brevo no configurado (BREVO_API_KEY requerida)');
    }

    const email = new brevo.SendSmtpEmail();
    email.sender = { email: params.sender.email, name: params.sender.name };
    email.to = params.to.map((r) => ({ email: r.email, name: r.name }));
    email.subject = params.subject;
    email.htmlContent = params.htmlContent;
    if (params.textContent) {
      email.textContent = params.textContent;
    }

    await this.api.sendTransacEmail(email);
  }
}
