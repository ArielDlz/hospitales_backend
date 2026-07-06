import { ApiProperty } from '@nestjs/swagger';
import { ProcesoPrueba } from '../entities/prueba-aspirante.entity';

export class PruebaActualDto {
  @ApiProperty({ example: 15 })
  idPruebaAspirante: number;

  @ApiProperty({ example: 'Prueba de conocimientos generales' })
  nombre: string;
}

export class PruebaAspiranteEstadoResponseDto {
  @ApiProperty({ type: PruebaActualDto })
  pruebaActual: PruebaActualDto;

  @ApiProperty({
    enum: ProcesoPrueba,
    example: ProcesoPrueba.Iniciada,
    description: 'Estatus actual de la prueba del aspirante',
  })
  status: ProcesoPrueba;
}
