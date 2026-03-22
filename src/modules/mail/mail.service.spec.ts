import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const vals: Record<string, string | number> = {
                SMTP_HOST: 'smtp.example.com',
                SMTP_PORT: 587,
                SMTP_USER: 'user',
                SMTP_PASS: 'pass',
                MAIL_FROM: 'noreply@example.com',
                PRIMER_ACCESO_DOMAIN: 'example.com',
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
});
