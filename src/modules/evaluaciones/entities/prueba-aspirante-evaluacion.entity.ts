import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** @deprecated Comentarios por intento ya no se usan; tabla conservada por datos históricos. */
@Entity('prueba_aspirante_evaluaciones')
export class PruebaAspiranteEvaluacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_prueba_aspirante', type: 'integer', unique: true })
  idPruebaAspirante: number;

  @Column({ name: 'id_evaluador', type: 'uuid' })
  idEvaluador: string;

  @Column({ type: 'text' })
  comentario: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
