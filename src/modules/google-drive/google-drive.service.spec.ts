import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveOauth } from './google-drive-oauth.entity';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import type { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';

jest.mock('googleapis', () => {
  const oauthClient = {
    generateAuthUrl: jest.fn().mockReturnValue(
      'https://accounts.google.com/o/oauth2/v2/auth?mock=1',
    ),
    getToken: jest.fn(),
    setCredentials: jest.fn(),
  };
  const driveApi = {
    files: {
      list: jest.fn(),
      create: jest.fn(),
    },
    about: {
      get: jest.fn(),
    },
  };
  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => oauthClient),
      },
      drive: jest.fn(() => driveApi),
    },
  };
});

function oauthClient() {
  return new (google.auth.OAuth2 as unknown as new () => {
    generateAuthUrl: jest.Mock;
    getToken: jest.Mock;
    setCredentials: jest.Mock;
  })();
}

function driveApi() {
  return google.drive({ version: 'v3' }) as unknown as {
    files: { list: jest.Mock; create: jest.Mock };
    about: { get: jest.Mock };
  };
}

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;

  const oauthRepo = {
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((row) => row),
    remove: jest.fn(),
  };
  const usuarioRepo = {
    findOne: jest.fn(),
  };
  const configValues: Record<string, string> = {
    GOOGLE_OAUTH_CLIENT_ID: 'client-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
    GOOGLE_OAUTH_REDIRECT_URI: 'https://admin.example/oauth/callback',
    GOOGLE_DRIVE_ENABLED_TENANT_IDS:
      '72ec5b8b-75e9-4956-b17d-85c946856a2d',
  };
  const configService = {
    get: jest.fn((key: string, fallback = '') => configValues[key] ?? fallback),
  };

  const superuser: JwtPayloadAdmin = {
    sub: 'super-1',
    type: 'admin',
    rol: RolUsuarioAdmin.Administrador,
    signature: false,
    supervisorId: null,
    supervisedUserIds: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    oauthClient().generateAuthUrl.mockReturnValue(
      'https://accounts.google.com/o/oauth2/v2/auth?mock=1',
    );
    oauthRepo.find.mockResolvedValue([]);
    usuarioRepo.findOne.mockResolvedValue({ id: 'super-1', isSuperuser: true });
    configService.get.mockImplementation(
      (key: string, fallback = '') => configValues[key] ?? fallback,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleDriveService,
        { provide: ConfigService, useValue: configService },
        { provide: getRepositoryToken(GoogleDriveOauth), useValue: oauthRepo },
        {
          provide: getRepositoryToken(UsuarioAdministrativo),
          useValue: usuarioRepo,
        },
      ],
    }).compile();

    service = module.get(GoogleDriveService);
  });

  it('getEnabledTenantIds lee el env', () => {
    expect(service.getEnabledTenantIds()).toEqual([
      '72ec5b8b-75e9-4956-b17d-85c946856a2d',
    ]);
    expect(service.isTenantEnabled('72EC5B8B-75E9-4956-B17D-85C946856A2D')).toBe(
      true,
    );
  });

  it('getStatus reporta connected y canConnect', async () => {
    oauthRepo.find.mockResolvedValue([
      { refreshToken: 'rt', googleEmail: 'hospital@gmail.com' },
    ]);

    const status = await service.getStatus(superuser);

    expect(status).toEqual({
      connected: true,
      googleEmail: 'hospital@gmail.com',
      canConnect: true,
    });
  });

  it('getAuthUrl usa access_type offline y prompt consent', () => {
    const result = service.getAuthUrl();
    expect(result.url).toContain('accounts.google.com');
    expect(oauthClient().generateAuthUrl).toHaveBeenCalledWith({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/drive'],
    });
  });

  it('getAuthUrl 503 si faltan credenciales', () => {
    configService.get.mockImplementation(() => '');
    expect(() => service.getAuthUrl()).toThrow(ServiceUnavailableException);
  });

  it('connectWithCode 400 si el code es inválido', async () => {
    oauthClient().getToken.mockRejectedValue(new Error('invalid_grant'));

    await expect(service.connectWithCode('bad', 'super-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('connectWithCode 400 si no hay refresh_token', async () => {
    oauthClient().getToken.mockResolvedValue({ tokens: { access_token: 'at' } });

    await expect(service.connectWithCode('code', 'super-1')).rejects.toThrow(
      /refresh_token/,
    );
  });

  it('connectWithCode guarda refresh token y email', async () => {
    oauthClient().getToken.mockResolvedValue({
      tokens: { refresh_token: 'rt-new', access_token: 'at' },
    });
    driveApi().about.get.mockResolvedValue({
      data: { user: { emailAddress: 'hospital@gmail.com' } },
    });
    oauthRepo.save.mockImplementation(async (row) => row);

    const result = await service.connectWithCode('ok-code', 'super-1');

    expect(oauthRepo.create).toHaveBeenCalled();
    expect(oauthRepo.save).toHaveBeenCalled();
    expect(result.connected).toBe(true);
    expect(result.googleEmail).toBe('hospital@gmail.com');
  });

  it('disconnect elimina la fila si existe', async () => {
    const row = { id: 1, refreshToken: 'rt' };
    oauthRepo.find.mockResolvedValue([row]);

    await service.disconnect();

    expect(oauthRepo.remove).toHaveBeenCalledWith(row);
  });

  it('uploadSignedInforme 503 si no hay conexión', async () => {
    oauthRepo.find.mockResolvedValue([]);

    await expect(
      service.uploadSignedInforme({
        hospitalNombre: 'hospital-general',
        modalidad: 'presencial',
        especialidad: 'cardiologia',
        filename: 'CURP_Cardio_2026.pdf',
        buffer: Buffer.from('%PDF'),
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('uploadSignedInforme reusa carpetas existentes y sube el PDF', async () => {
    oauthRepo.find.mockResolvedValue([{ refreshToken: 'rt' }]);
    driveApi().files.list
      .mockResolvedValueOnce({
        data: { files: [{ id: 'hosp-id', name: 'hospital-general' }] },
      })
      .mockResolvedValueOnce({
        data: { files: [{ id: 'mod-id', name: 'PRESENCIAL' }] },
      })
      .mockResolvedValueOnce({
        data: { files: [{ id: 'esp-id', name: 'cardiologia' }] },
      });
    driveApi().files.create.mockResolvedValue({
      data: {
        id: 'file-99',
        webViewLink: 'https://drive.google.com/file/d/file-99/view',
      },
    });

    const result = await service.uploadSignedInforme({
      hospitalNombre: 'hospital-general',
      modalidad: 'presencial',
      especialidad: 'cardiologia',
      filename: 'CURP_Cardiología_2026.pdf',
      buffer: Buffer.from('%PDF'),
    });

    expect(result).toEqual({
      fileId: 'file-99',
      webViewLink: 'https://drive.google.com/file/d/file-99/view',
    });
    expect(driveApi().files.create).toHaveBeenCalledTimes(1);
  });
});
