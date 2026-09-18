import { Readable } from 'stream';
import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google, drive_v3 } from 'googleapis';
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

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
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
      const drive = await this.getDriveClient();
      const hospitalFolderId = await this.ensureFolder(
        drive,
        ROOT_PARENT,
        params.hospitalNombre,
      );
      const modalidadFolderId = await this.ensureFolder(
        drive,
        hospitalFolderId,
        params.modalidad,
      );
      const especialidadFolderId = await this.ensureFolder(
        drive,
        modalidadFolderId,
        params.especialidad,
      );

      const created = await drive.files.create({
        requestBody: {
          name: params.filename,
          parents: [especialidadFolderId],
        },
        media: {
          mimeType: 'application/pdf',
          body: Readable.from(params.buffer),
        },
        fields: 'id, webViewLink',
      });

      const fileId = created.data.id?.trim();
      const webViewLink = created.data.webViewLink?.trim();
      if (!fileId || !webViewLink) {
        throw new ServiceUnavailableException(
          'Google Drive no devolvió el archivo subido',
        );
      }
      return { fileId, webViewLink };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new ServiceUnavailableException(
        'No se pudo subir el informe a Google Drive',
      );
    }
  }

  private async readConnectedEmail(
    client: InstanceType<typeof google.auth.OAuth2>,
  ): Promise<string | null> {
    try {
      const drive = google.drive({ version: 'v3', auth: client });
      const about = await drive.about.get({ fields: 'user(emailAddress)' });
      return about.data.user?.emailAddress ?? null;
    } catch {
      return null;
    }
  }

  private async getDriveClient(): Promise<drive_v3.Drive> {
    const connection = await this.findConnection();
    if (!connection?.refreshToken?.trim()) {
      throw new ServiceUnavailableException('Google Drive no está conectado');
    }
    const client = this.createOAuthClient();
    client.setCredentials({ refresh_token: connection.refreshToken });
    return google.drive({ version: 'v3', auth: client });
  }

  private async ensureFolder(
    drive: drive_v3.Drive,
    parentId: string,
    name: string,
  ): Promise<string> {
    const folders = await this.listChildFolders(drive, parentId);
    const existingId = findFolderIdByNameCaseInsensitive(folders, name);
    if (existingId) {
      return existingId;
    }

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: FOLDER_MIME,
        parents: [parentId],
      },
      fields: 'id, name',
    });
    const id = created.data.id?.trim();
    if (!id) {
      throw new ServiceUnavailableException(
        'Google Drive no pudo crear la carpeta',
      );
    }
    return id;
  }

  private async listChildFolders(
    drive: drive_v3.Drive,
    parentId: string,
  ): Promise<Array<{ id?: string | null; name?: string | null }>> {
    const folders: Array<{ id?: string | null; name?: string | null }> = [];
    let pageToken: string | undefined;
    const escapedParent = parentId.replace(/'/g, "\\'");
    const q = `'${escapedParent}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`;

    do {
      const res = await drive.files.list({
        q,
        fields: 'nextPageToken, files(id, name)',
        pageSize: 1000,
        pageToken,
        spaces: 'drive',
      });
      folders.push(...(res.data.files ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return folders;
  }

  private async findConnection(): Promise<GoogleDriveOauth | null> {
    const rows = await this.oauthRepository.find({
      order: { id: 'ASC' },
      take: 1,
    });
    return rows[0] ?? null;
  }

  private createOAuthClient(): InstanceType<typeof google.auth.OAuth2> {
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
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }
}
