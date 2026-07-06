import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Aspirante } from '../aspirante/aspirante.entity';
import { Hospital } from '../hospital/hospital.entity';
import { BrevoClient } from './brevo.client';
import { buildPrimerAccesoEmail } from './templates/primer-acceso.template';
import { buildEvaluadorRegistroEmail } from './templates/evaluador-registro.template';

export interface MailFailureAlertContext {
  aspiranteId: string;
  aspiranteEmail: string;
  hospitalNombre: string;
  errorMessage: string;
}

export interface EvaluadorMailFailureAlertContext {
  evaluadorId: string;
  evaluadorEmail: string;
  errorMessage: string;
}

export interface SendEvaluadorRegistroEmailParams {
  email: string;
  nombre: string;
  password: string;
}

@Injectable()
export class MailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly brevoClient: BrevoClient,
  ) {}

  private getSender(): { email: string; name: string } {
    const email = this.configService.get<string>(
      'MAIL_FROM',
      'registro@arieldelao.dev',
    );
    const name = this.configService.get<string>('MAIL_FROM_NAME', 'Registro');
    return { email, name };
  }

  private assertBrevoConfigured(): void {
    if (!this.brevoClient.isEnabled()) {
      throw new Error('Brevo no configurado (BREVO_API_KEY requerida)');
    }
  }

  async sendPrimerAccesoEmail(
    aspirante: Aspirante,
    token: string,
    hospital: Hospital,
  ): Promise<void> {
    this.assertBrevoConfigured();

    const domain = this.configService.get<string>('PRIMER_ACCESO_DOMAIN');
    if (!domain) {
      throw new Error('PRIMER_ACCESO_DOMAIN is required for primer acceso links');
    }

    const activacionUrl = `https://${hospital.slug}.${domain}/confirmar-acceso?token=${token}`;
    const { subject, html, text } = buildPrimerAccesoEmail({
      nombre: aspirante.nombre,
      apellidos: aspirante.apellidos,
      telefono: aspirante.telefono,
      registroHospital: aspirante.registroHospital,
      activacionUrl,
    });

    const sender = this.getSender();
    await this.brevoClient.sendTransactional({
      sender,
      to: [{ email: aspirante.email }],
      subject,
      htmlContent: html,
      textContent: text,
    });
  }

  async sendEvaluadorRegistroEmail(
    params: SendEvaluadorRegistroEmailParams,
  ): Promise<void> {
    this.assertBrevoConfigured();

    const domain = this.configService.get<string>(
      'ADMIN_LOGIN_DOMAIN',
      'admin.arieldelao.dev',
    );
    const loginUrl = domain.startsWith('http') ? domain : `https://${domain}`;

    const { subject, html, text } = buildEvaluadorRegistroEmail({
      nombre: params.nombre,
      password: params.password,
      loginUrl,
    });

    const sender = this.getSender();
    await this.brevoClient.sendTransactional({
      sender,
      to: [{ email: params.email }],
      subject,
      htmlContent: html,
      textContent: text,
    });
  }

  async sendEvaluadorMailFailureAlert(
    context: EvaluadorMailFailureAlertContext,
  ): Promise<void> {
    const adminEmail = this.configService.get<string>('ADMIN_NOTIFY_EMAIL', '');
    if (!adminEmail || !this.brevoClient.isEnabled()) {
      return;
    }

    const sender = this.getSender();
    const subject = '[Alerta] Fallo envío correo registro evaluador';
    const text = [
      'No se pudo enviar el correo de bienvenida a un evaluador recién creado.',
      '',
      `Evaluador ID: ${context.evaluadorId}`,
      `Email evaluador: ${context.evaluadorEmail}`,
      `Error: ${context.errorMessage}`,
      '',
      'El evaluador quedó registrado en el sistema. Revisa la configuración de Brevo o reenvía las credenciales manualmente.',
    ].join('\n');

    const html = text.replace(/\n/g, '<br>');

    await this.brevoClient.sendTransactional({
      sender,
      to: [{ email: adminEmail }],
      subject,
      htmlContent: `<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;">${html}</p>`,
      textContent: text,
    });
  }

  async sendAdminMailFailureAlert(
    context: MailFailureAlertContext,
  ): Promise<void> {
    const adminEmail = this.configService.get<string>('ADMIN_NOTIFY_EMAIL', '');
    if (!adminEmail || !this.brevoClient.isEnabled()) {
      return;
    }

    const sender = this.getSender();
    const subject = `[Alerta] Fallo envío correo primer acceso - ${context.hospitalNombre}`;
    const text = [
      'No se pudo enviar el correo de activación a un aspirante recién creado.',
      '',
      `Hospital: ${context.hospitalNombre}`,
      `Aspirante ID: ${context.aspiranteId}`,
      `Email aspirante: ${context.aspiranteEmail}`,
      `Error: ${context.errorMessage}`,
      '',
      'El aspirante quedó registrado en el sistema. Revisa la configuración de Brevo o reenvía la invitación manualmente.',
    ].join('\n');

    const html = text.replace(/\n/g, '<br>');

    await this.brevoClient.sendTransactional({
      sender,
      to: [{ email: adminEmail }],
      subject,
      htmlContent: `<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;">${html}</p>`,
      textContent: text,
    });
  }
}
