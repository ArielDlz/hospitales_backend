import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pruebas_respuestas_opciones')
export class PruebaRespuestaOpcion {
  @PrimaryGeneratedColumn({ name: 'id_prueba_respuesta_opcion' })
  idPruebaRespuestaOpcion: number;

  @Column({ name: 'id_prueba_respuesta', type: 'integer' })
  idPruebaRespuesta: number;

  @Column({ name: 'id_pregunta_opcion', type: 'integer' })
  idPreguntaOpcion: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
