import { ApiProperty } from '@nestjs/swagger';

export class ClaimPaymentResponseDto {
  @ApiProperty({
    example: '2026-09-18T22:00:00.000Z',
    description:
      'Momento en que el aspirante pulsó Ya pagué. No confirma el cobro ni avanza el flujo.',
  })
  claimedAt: Date;
}
