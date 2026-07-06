import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('preguntas_tipo')
export class PreguntaTipo {
  @PrimaryGeneratedColumn({ name: 'id_pregunta_tipo' })
  idPreguntaTipo: number;

  @Column({ type: 'text' })
  descripcion: string;
}
