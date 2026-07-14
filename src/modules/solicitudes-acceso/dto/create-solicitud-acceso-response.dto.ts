import { ApiProperty } from '@nestjs/swagger';

export enum CreateSolicitudAccesoEstado {
  Creada = 'creada',
  YaAspirante = 'ya_aspirante',
  YaSolicitada = 'ya_solicitada',
  HospitalNoEncontrado = 'hospital_no_encontrado',
}

export class CreateSolicitudAccesoResponseDto {
  @ApiProperty({
    enum: CreateSolicitudAccesoEstado,
    example: CreateSolicitudAccesoEstado.Creada,
  })
  estado: CreateSolicitudAccesoEstado;

  @ApiProperty({
    example: 'Solicitud enviada. El hospital la revisará.',
  })
  mensaje: string;
}
