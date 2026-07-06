import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePruebaDto } from './create-prueba.dto';

export class UpdatePruebaDto extends PartialType(CreatePruebaDto) {
  @ApiPropertyOptional({
    description:
      'Solo administradores suelen cambiar este campo; útil para reactivar una prueba archivada.',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
