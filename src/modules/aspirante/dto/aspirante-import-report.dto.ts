import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AspiranteImportRowErrorDto {
  @ApiProperty({ example: 2, description: 'Número de fila en Excel (encabezado = 1)' })
  rowNumber: number;

  @ApiPropertyOptional({ example: 'aspirante@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: 'REG-2026-001' })
  registroHospital?: string;

  @ApiProperty({
    type: [String],
    example: ['email es requerido'],
  })
  messages: string[];
}

export class AspiranteImportReportDto {
  @ApiProperty({
    example: true,
    description: 'true solo si todas las filas son válidas',
  })
  ok: boolean;

  @ApiProperty({ example: 10 })
  totalRows: number;

  @ApiProperty({ example: 8 })
  validRows: number;

  @ApiProperty({ example: 2 })
  invalidRows: number;

  @ApiProperty({ type: [AspiranteImportRowErrorDto] })
  errors: AspiranteImportRowErrorDto[];

  @ApiPropertyOptional({
    example: 10,
    description: 'Solo en import exitoso: aspirantes creados',
  })
  created?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Solo en import: correos de invitación enviados correctamente',
  })
  emailsEnviados?: number;
}
