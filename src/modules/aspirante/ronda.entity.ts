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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
