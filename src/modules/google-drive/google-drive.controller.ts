import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { SuperuserGuard } from '../auth/guards/superuser.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveStatusResponseDto } from './dto/google-drive-status-response.dto';
import { GoogleDriveOauthUrlResponseDto } from './dto/google-drive-oauth-url-response.dto';
import { GoogleDriveOauthCallbackDto } from './dto/google-drive-oauth-callback.dto';
import { GoogleDriveOauthConnectedResponseDto } from './dto/google-drive-oauth-connected-response.dto';

@ApiTags('google-drive')
@Controller('google-drive')
@UseGuards(AdminOnlyGuard)
@ApiBearerAuth('JWT-auth')
export class GoogleDriveController {
  constructor(private readonly googleDriveService: GoogleDriveService) {}

  @Get('status')
  @ApiOperation({
    summary:
      'Estado de la cuenta Google Drive global (cualquier admin/evaluador)',
  })
  @ApiOkResponse({ type: GoogleDriveStatusResponseDto })
  async getStatus(
    @CurrentUser() user: JwtPayloadAdmin,
  ): Promise<GoogleDriveStatusResponseDto> {
    return this.googleDriveService.getStatus(user);
  }

  @Get('oauth/url')
  @UseGuards(SuperuserGuard)
  @ApiOperation({
    summary:
      'URL de consentimiento Google (solo superusuario). access_type=offline y prompt=consent',
  })
  @ApiOkResponse({ type: GoogleDriveOauthUrlResponseDto })
  getAuthUrl(): GoogleDriveOauthUrlResponseDto {
    return this.googleDriveService.getAuthUrl();
  }

  @Post('oauth/callback')
  @UseGuards(SuperuserGuard)
  @ApiOperation({
    summary:
      'Intercambia el code de Google por refresh token (solo superusuario). El frontend envía el code.',
  })
  @ApiOkResponse({ type: GoogleDriveOauthConnectedResponseDto })
  async connectWithCode(
    @Body() dto: GoogleDriveOauthCallbackDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ): Promise<GoogleDriveOauthConnectedResponseDto> {
    return this.googleDriveService.connectWithCode(dto.code, user.sub);
  }

  @Delete('oauth')
  @UseGuards(SuperuserGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Desconectar Google Drive (solo superusuario). Los archivos ya subidos permanecen en Drive.',
  })
  @ApiNoContentResponse()
  async disconnect(): Promise<void> {
    await this.googleDriveService.disconnect();
  }
}
