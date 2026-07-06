import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pruebas_respuestas')
export class PruebaRespuesta {
  @PrimaryGeneratedColumn({ name: 'id_prueba_respuesta' })
  idPruebaRespuesta: number;

  @Column({ name: 'id_prueba_aspirante', type: 'integer' })
  idPruebaAspirante: number;

  @Column({ name: 'id_pregunta', type: 'integer' })
  idPregunta: number;

  @Column({ name: 'respuesta_texto', type: 'text', nullable: true })
  respuestaTexto: string | null;

  @Column({ name: 'id_pregunta_opcion', type: 'integer', nullable: true })
  idPreguntaOpcion: number | null;

  @Column({ name: 'url_respuesta', type: 'text', nullable: true })
  urlRespuesta: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
