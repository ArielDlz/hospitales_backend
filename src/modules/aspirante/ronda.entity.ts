import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('rondas')
/** Case-insensitive uniqueness is enforced in SQL by uk_rondas_tenant_etiqueta on (tenant_id, lower(etiqueta)). */
@Index('uk_rondas_tenant_etiqueta', ['tenantId', 'etiqueta'], { unique: true })
export class Ronda {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'text' })
  etiqueta: string;

  /** Null means the ronda is open. Access closes when now is past this instant. */
  @Column({ type: 'timestamptz', name: 'fecha_cierre', nullable: true })
  fechaCierre: Date | null;

  /** False blocks new evaluation claims. True with an empty allow-list means every evaluador. */
  @Column({ type: 'boolean', name: 'puede_evaluar', default: true })
  puedeEvaluar: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
