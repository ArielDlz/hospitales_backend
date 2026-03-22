import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Token JWT para autenticación',
  })
  accessToken: string;

  @ApiProperty({
    example: '7d',
    description: 'Tiempo de expiración del token',
  })
  expiresIn: string;
}
