import { ApiProperty } from '@nestjs/swagger';

export class GoogleDriveOauthUrlResponseDto {
  @ApiProperty({
    example: 'https://accounts.google.com/o/oauth2/v2/auth?...',
  })
  url: string;
}
