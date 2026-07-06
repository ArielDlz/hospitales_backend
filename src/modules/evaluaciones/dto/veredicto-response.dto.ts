import { ApiProperty } from '@nestjs/swagger';

export class VeredictoResponseDto {
  @ApiProperty({ example: 1 })
  idVeredicto: number;

  @ApiProperty({ example: 'aceptado' })
  codigo: string;

  @ApiProperty({ example: 'Aceptado' })
  etiqueta: string;
}
