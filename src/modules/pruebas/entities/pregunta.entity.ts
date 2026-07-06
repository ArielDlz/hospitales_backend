import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('preguntas')
export class Pregunta {
  @PrimaryGeneratedColumn({ name: 'id_pregunta' })
  idPregunta: number;

  @Column({ name: 'id_prueba', type: 'integer' })
  idPrueba: number;

  @Column({ type: 'text' })
  texto: string;

  @Column({ name: 'id_tipo', type: 'integer' })
  idTipo: number;

  @Column({ type: 'integer' })
  orden: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
