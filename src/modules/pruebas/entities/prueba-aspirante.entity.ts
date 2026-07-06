import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ProcesoPrueba {
  Pendiente = 'pendiente',
  Iniciada = 'iniciada',
  PorEvaluar = 'por_evaluar',
  Revisada = 'revisada',
  Evaluada = 'evaluada',
  ReporteGenerado = 'reporte_generado',
  Finalizada = 'finalizada',
}

@Entity('pruebas_aspirantes')
export class PruebaAspirante {
  @PrimaryGeneratedColumn({ name: 'id_prueba_aspirante' })
  idPruebaAspirante: number;

  @Column({ name: 'id_prueba', type: 'integer' })
  idPrueba: number;

  @Column({ name: 'id_aspirante', type: 'uuid' })
  idAspirante: string;

  @Column({ name: 'inicio_at', type: 'timestamptz', nullable: true })
  inicioAt: Date | null;

  @Column({ name: 'fin_at', type: 'timestamptz', nullable: true })
  finAt: Date | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ProcesoPrueba,
    enumName: 'proceso_prueba_enum',
  })
  status: ProcesoPrueba;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
