import { ApiProperty } from '@nestjs/swagger';

export class GoogleDriveStatusResponseDto {
  @ApiProperty({ example: true })
  connected: boolean;

  @ApiProperty({
    example: 'hospital@gmail.com',
    nullable: true,
  })
  googleEmail: string | null;

  @ApiProperty({
    example: true,
    description: 'true si el usuario autenticado es superusuario y puede conectar Drive',
  })
  canConnect: boolean;
}
