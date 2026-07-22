import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsUUID } from 'class-validator';

export class SendRecordatorioPruebasDto {
  @ApiProperty({
    example: 'aspirante@example.com',
    description: 'Email del aspirante',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID del hospital (tenant)',
  })
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;
}
