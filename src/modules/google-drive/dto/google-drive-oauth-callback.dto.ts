import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleDriveOauthCallbackDto {
  @ApiProperty({
    example: '4/0AanRRrs...',
    description: 'Authorization code que Google envía al frontend',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
