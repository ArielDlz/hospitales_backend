import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class InformeExtendidoDto {
  @ApiProperty({
    description:
      'Markdown del anexo. Cadena vacía borra el anexo y regenera el PDF sin páginas extra.',
    example: '## Observación\n\nEl aspirante **requiere** seguimiento.',
  })
  @IsString()
  informeExtendido: string;
}
