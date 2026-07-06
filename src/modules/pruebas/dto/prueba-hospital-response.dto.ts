import { ApiProperty } from '@nestjs/swagger';

export class PruebaHospitalResponseDto {
  @ApiProperty({ example: 10 })
  idPruebaHospital: number;

  @ApiProperty({ example: 1 })
  idPrueba: number;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  tenantId: string;

  @ApiProperty({ example: true })
  show: boolean;
}
