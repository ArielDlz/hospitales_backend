import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@example.com', description: 'Email del administrador' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '********',
    description: 'Contraseña',
    minLength: 1,
    type: 'string',
    format: 'password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password: string;
}
