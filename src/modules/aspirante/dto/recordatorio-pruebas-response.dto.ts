import { ApiProperty } from '@nestjs/swagger';

export class RecordatorioPruebasResponseDto {
  @ApiProperty({
    example: 'Recordatorio enviado correctamente',
  })
  message: string;

  @ApiProperty({ example: true })
  emailEnviado: boolean;
}
