import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdatePruebaHospitalDto {
  @ApiProperty({
    example: true,
    description: 'Disponibilidad de la prueba en el hospital',
  })
  @IsBoolean()
  show: boolean;
}
