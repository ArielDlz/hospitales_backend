import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Aspirante } from '../aspirante/aspirante.entity';
import { Hospital } from '../hospital/hospital.entity';

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initTransport();
  }

  private initTransport(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  async sendPrimerAccesoEmail(
    aspirante: Aspirante,
    token: string,
    hospital: Hospital,
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error('Mail transport not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)');
    }

    const domain = this.configService.get<string>('PRIMER_ACCESO_DOMAIN');
    if (!domain) {
      throw new Error('PRIMER_ACCESO_DOMAIN is required for primer acceso links');
    }

    const url = `https://${hospital.slug}.${domain}/confirmar-acceso?token=${token}`;
    const from = this.configService.get<string>('MAIL_FROM', 'noreply@example.com');

    const subject = `Activa tu cuenta - ${hospital.nombre}`;
    const body = `
Hola,

Te han registrado como aspirante en ${hospital.nombre}.

Para activar tu cuenta y establecer tu contraseña, haz clic en el siguiente enlace:

${url}

Este enlace caduca en 7 días.

Si no has solicitado este registro, puedes ignorar este correo.
`;

    await this.transporter.sendMail({
      from,
      to: aspirante.email,
      subject,
      text: body.trim(),
      html: body.trim().replace(/\n/g, '<br>'),
    });
  }
}
