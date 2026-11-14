import { ApiProperty } from '@nestjs/swagger';

export class RondaFechaCierreResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  etiqueta: string;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  fechaCierre: Date | null;
}
