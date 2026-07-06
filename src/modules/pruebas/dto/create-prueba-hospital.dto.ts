import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class CreatePruebaHospitalDto {
  @ApiProperty({ example: 1, description: 'ID de la prueba (id_prueba)' })
  @IsInt()
  @Min(1)
  id_prueba: number;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID del hospital (tenant_id)',
  })
  @IsUUID()
  tenant_id: string;
}
