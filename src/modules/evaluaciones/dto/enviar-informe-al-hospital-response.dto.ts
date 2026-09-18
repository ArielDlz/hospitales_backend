import { ApiProperty } from '@nestjs/swagger';

export class EnviarInformeAlHospitalResponseDto {
  @ApiProperty({ example: '1abc2def3ghi' })
  googleDriveFileId: string;

  @ApiProperty({
    example: 'https://drive.google.com/file/d/1abc2def3ghi/view',
  })
  googleDriveFileUrl: string;

  @ApiProperty({ example: '2026-09-18T14:23:00.000Z' })
  enviadoAlHospitalAt: Date;

  @ApiProperty({ example: 'Informe enviado al hospital correctamente' })
  message: string;
}
