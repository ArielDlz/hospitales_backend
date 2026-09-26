import { ApiProperty } from '@nestjs/swagger';

export class InformeExtendidoResponseDto {
  @ApiProperty({
    example:
      'https://bucket.s3.amazonaws.com/informes-firmados/hospital/especialidad/CURP_1_A_25_2027_extendido_20260926T201500.pdf',
  })
  veredictoInforme: string;

  @ApiProperty({ example: 'Informe extendido guardado correctamente' })
  message: string;
}
