import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('preguntas_opciones')
export class PreguntaOpcion {
  @PrimaryGeneratedColumn({ name: 'id_pregunta_opcion' })
  idPreguntaOpcion: number;

  @Column({ name: 'id_pregunta', type: 'integer' })
  idPregunta: number;

  @Column({ type: 'text' })
  opcion: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'boolean', default: false })
  correcta: boolean;
}
