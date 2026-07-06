import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { BrevoClient } from './brevo.client';
import { Aspirante } from '../aspirante/aspirante.entity';
import { Hospital } from '../hospital/hospital.entity';

describe('MailService', () => {
  let service: MailService;
  let brevoClient: { isEnabled: jest.Mock; sendTransactional: jest.Mock };

  const hospital = {
    nombre: 'Hospital Test',
    slug: 'hospital-test',
  } as Hospital;

  const aspirante = {
    email: 'aspirante@example.com',
    nombre: 'Juan',
    apellidos: 'García',
    telefono: '5551234567',
    registroHospital: 'REG-001',
  } as Aspirante;

  beforeEach(async () => {
    brevoClient = {
      isEnabled: jest.fn().mockReturnValue(true),
      sendTransactional: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: BrevoClient,
          useValue: brevoClient,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const vals: Record<string, string> = {
                MAIL_FROM: 'registro@arieldelao.dev',
                MAIL_FROM_NAME: 'Registro',
                PRIMER_ACCESO_DOMAIN: 'arieldelao.dev',
                ADMIN_LOGIN_DOMAIN: 'admin.arieldelao.dev',
                ADMIN_NOTIFY_EMAIL: 'admin@example.com',
              };
              return vals[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sendPrimerAccesoEmail should call Brevo with HTML and correct sender', async () => {
    await service.sendPrimerAccesoEmail(aspirante, 'token-abc', hospital);

    expect(brevoClient.sendTransactional).toHaveBeenCalledWith(
      expect.objectContaining({
        sender: { email: 'registro@arieldelao.dev', name: 'Registro' },
        to: [{ email: 'aspirante@example.com' }],
        subject:
          'Confirma tu registro a la plataforma de pruebas psicométricas',
        htmlContent: expect.stringContaining('Hola, Juan'),
        textContent: expect.stringContaining('REG-001'),
      }),
    );
    expect(brevoClient.sendTransactional.mock.calls[0][0].htmlContent).toContain(
      'https://hospital-test.arieldelao.dev/confirmar-acceso?token=token-abc',
    );
  });

  it('sendPrimerAccesoEmail should throw when Brevo is not configured', async () => {
    brevoClient.isEnabled.mockReturnValue(false);

    await expect(
      service.sendPrimerAccesoEmail(aspirante, 'token', hospital),
    ).rejects.toThrow('Brevo no configurado');
  });

  it('sendEvaluadorRegistroEmail should call Brevo with HTML and login URL', async () => {
    await service.sendEvaluadorRegistroEmail({
      email: 'evaluador@example.com',
      nombre: 'María',
      password: 'SecurePass123',
    });

    expect(brevoClient.sendTransactional).toHaveBeenCalledWith(
      expect.objectContaining({
        sender: { email: 'registro@arieldelao.dev', name: 'Registro' },
        to: [{ email: 'evaluador@example.com' }],
        subject: 'Registro como evaluador - Psique y Cultura',
        htmlContent: expect.stringContaining('Hola María,'),
        textContent: expect.stringContaining('SecurePass123'),
      }),
    );
    expect(brevoClient.sendTransactional.mock.calls[0][0].htmlContent).toContain(
      'https://admin.arieldelao.dev',
    );
    expect(brevoClient.sendTransactional.mock.calls[0][0].htmlContent).toContain(
      'Accede ahora',
    );
  });

  it('sendEvaluadorRegistroEmail should throw when Brevo is not configured', async () => {
    brevoClient.isEnabled.mockReturnValue(false);

    await expect(
      service.sendEvaluadorRegistroEmail({
        email: 'evaluador@example.com',
        nombre: 'María',
        password: 'pass',
      }),
    ).rejects.toThrow('Brevo no configurado');
  });

  it('sendAdminMailFailureAlert should notify admin', async () => {
    await service.sendAdminMailFailureAlert({
      aspiranteId: 'id-1',
      aspiranteEmail: 'aspirante@example.com',
      hospitalNombre: 'Hospital Test',
      errorMessage: 'API error',
    });

    expect(brevoClient.sendTransactional).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [{ email: 'admin@example.com' }],
        subject: expect.stringContaining('Fallo envío correo'),
        textContent: expect.stringContaining('id-1'),
      }),
    );
  });
});
