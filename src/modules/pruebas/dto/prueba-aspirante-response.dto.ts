import { ApiProperty } from '@nestjs/swagger';
import { ProcesoPrueba } from '../entities/prueba-aspirante.entity';

export class PruebaAspiranteResponseDto {
  @ApiProperty({ example: 15 })
  idPruebaAspirante: number;

  @ApiProperty({ example: 1 })
  idPrueba: number;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  idAspirante: string;

  @ApiProperty({ example: '2026-04-21T07:30:00.000Z' })
  inicioAt: Date | null;

  @ApiProperty({ nullable: true, example: null })
  finAt: Date | null;

  @ApiProperty({
    enum: ProcesoPrueba,
    example: ProcesoPrueba.Iniciada,
  })
  status: ProcesoPrueba;
}
