import { ApiProperty } from '@nestjs/swagger';

export class GoogleDriveOauthConnectedResponseDto {
  @ApiProperty({ example: true })
  connected: boolean;

  @ApiProperty({ example: 'hospital@gmail.com', nullable: true })
  googleEmail: string | null;

  @ApiProperty({ example: 'Google Drive conectado correctamente' })
  message: string;
}
