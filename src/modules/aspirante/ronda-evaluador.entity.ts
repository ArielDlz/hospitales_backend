import { Entity, PrimaryColumn } from 'typeorm';

@Entity('ronda_evaluadores')
export class RondaEvaluador {
  @PrimaryColumn({ type: 'uuid', name: 'ronda_id' })
  rondaId: string;

  @PrimaryColumn({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;
}
