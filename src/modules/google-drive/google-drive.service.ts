import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuth2Client } from 'google-auth-library';
import { GoogleDriveOauth } from './google-drive-oauth.entity';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { GoogleDriveStatusResponseDto } from './dto/google-drive-status-response.dto';
import { GoogleDriveOauthConnectedResponseDto } from './dto/google-drive-oauth-connected-response.dto';
import { findFolderIdByNameCaseInsensitive } from './google-drive-folders.util';
import {
  isTenantDriveEnabled,
  parseEnabledTenantIds,
} from './google-drive-tenants';
import {
  createFolder,
  getAboutEmail,
  listChildFolders,
  uploadPdf,
} from './google-drive-rest';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const ROOT_PARENT = 'root';

export type UploadSignedInformeParams = {
  hospitalNombre: string;
  modalidad: string;
  especialidad: string;
  filename: string;
  buffer: Buffer;
};

export type UploadSignedInformeResult = {
  fileId: string;
  webViewLink: string;
};

@Injectable()
export class GoogleDriveService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(GoogleDriveOauth)
    private readonly oauthRepository: Repository<GoogleDriveOauth>,
    @InjectRepository(UsuarioAdministrativo)
    private readonly usuarioRepository: Repository<UsuarioAdministrativo>,
  ) {}

  getEnabledTenantIds(): string[] {
    return parseEnabledTenantIds(
      this.configService.get<string>('GOOGLE_DRIVE_ENABLED_TENANT_IDS', ''),
    );
  }

  isTenantEnabled(tenantId: string): boolean {
    return isTenantDriveEnabled(tenantId, this.getEnabledTenantIds());
  }

  async getStatus(user: JwtPayloadAdmin): Promise<GoogleDriveStatusResponseDto> {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: user.sub, active: true },
      select: ['id', 'isSuperuser'],
    });
    const connection = await this.findConnection();
    return {
      connected: Boolean(connection?.refreshToken?.trim()),
      googleEmail: connection?.googleEmail ?? null,
      canConnect: Boolean(usuario?.isSuperuser),
    };
  }

  getAuthUrl(): { url: string } {
    const client = this.createOAuthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [DRIVE_SCOPE],
    });
    return { url };
  }

  async connectWithCode(
    code: string,
    userId: string,
  ): Promise<GoogleDriveOauthConnectedResponseDto> {
    const client = this.createOAuthClient();
    let tokens: { refresh_token?: string | null; access_token?: string | null };
    try {
      const result = await client.getToken(code.trim());
      tokens = result.tokens;
    } catch {
      throw new BadRequestException(
        'Código de Google inválido o expirado',
      );
    }

    const existing = await this.findConnection();
    const refreshToken = tokens.refresh_token ?? existing?.refreshToken;
    if (!refreshToken?.trim()) {
      throw new BadRequestException(
        'Google no devolvió refresh_token. Vuelva a conectar otorgando consentimiento.',
      );
    }

    client.setCredentials({ ...tokens, refresh_token: refreshToken });
    const googleEmail = await this.readConnectedEmail(client);

    const now = new Date();
    if (existing) {
      existing.refreshToken = refreshToken;
      existing.googleEmail = googleEmail;
      existing.connectedByUserId = userId;
      existing.connectedAt = now;
      await this.oauthRepository.save(existing);
    } else {
      await this.oauthRepository.save(
        this.oauthRepository.create({
          refreshToken,
          googleEmail,
          connectedByUserId: userId,
          connectedAt: now,
        }),
      );
    }

    return {
      connected: true,
      googleEmail,
      message: 'Google Drive conectado correctamente',
    };
  }

  async disconnect(): Promise<void> {
    const existing = await this.findConnection();
    if (existing) {
      await this.oauthRepository.remove(existing);
    }
  }

  async uploadSignedInforme(
    params: UploadSignedInformeParams,
  ): Promise<UploadSignedInformeResult> {
    try {
      const accessToken = await this.getAccessToken();
      const hospitalFolderId = await this.ensureFolder(
        accessToken,
        ROOT_PARENT,
        params.hospitalNombre,
      );
      const modalidadFolderId = await this.ensureFolder(
        accessToken,
        hospitalFolderId,
        params.modalidad,
      );
      const especialidadFolderId = await this.ensureFolder(
        accessToken,
        modalidadFolderId,
        params.especialidad,
      );

      return await uploadPdf({
        accessToken,
        parentId: especialidadFolderId,
        filename: params.filename,
        buffer: params.buffer,
      });
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new ServiceUnavailableException(
        'No se pudo subir el informe a Google Drive',
      );
    }
  }

  private async readConnectedEmail(client: OAuth2Client): Promise<string | null> {
    try {
      const accessToken = await this.accessTokenFromClient(client);
      return await getAboutEmail(accessToken);
    } catch {
      return null;
    }
  }

  private async getAccessToken(): Promise<string> {
    const connection = await this.findConnection();
    if (!connection?.refreshToken?.trim()) {
      throw new ServiceUnavailableException('Google Drive no está conectado');
    }
    const client = this.createOAuthClient();
    client.setCredentials({ refresh_token: connection.refreshToken });
    return this.accessTokenFromClient(client);
  }

  private async accessTokenFromClient(client: OAuth2Client): Promise<string> {
    const { token } = await client.getAccessToken();
    if (!token?.trim()) {
      throw new ServiceUnavailableException(
        'No se pudo obtener el token de Google Drive',
      );
    }
    return token;
  }

  private async ensureFolder(
    accessToken: string,
    parentId: string,
    name: string,
  ): Promise<string> {
    const folders = await listChildFolders(accessToken, parentId);
    const existingId = findFolderIdByNameCaseInsensitive(folders, name);
    if (existingId) {
      return existingId;
    }
    return createFolder(accessToken, parentId, name);
  }

  private async findConnection(): Promise<GoogleDriveOauth | null> {
    const rows = await this.oauthRepository.find({
      order: { id: 'ASC' },
      take: 1,
    });
    return rows[0] ?? null;
  }

  private createOAuthClient(): OAuth2Client {
    const clientId = this.configService
      .get<string>('GOOGLE_OAUTH_CLIENT_ID', '')
      .trim();
    const clientSecret = this.configService
      .get<string>('GOOGLE_OAUTH_CLIENT_SECRET', '')
      .trim();
    const redirectUri = this.configService
      .get<string>('GOOGLE_OAUTH_REDIRECT_URI', '')
      .trim();
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException(
        'Google Drive no está configurado',
      );
    }
    return new OAuth2Client(clientId, clientSecret, redirectUri);
  }
}
