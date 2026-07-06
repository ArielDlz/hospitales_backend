import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('aspirante_evaluaciones')
export class AspiranteEvaluacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_aspirante', type: 'uuid', unique: true })
  idAspirante: string;

  @Column({ name: 'id_evaluador', type: 'uuid' })
  idEvaluador: string;

  @Column({ name: 'id_veredicto', type: 'integer' })
  idVeredicto: number;

  @Column({ type: 'text' })
  comentario: string;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
