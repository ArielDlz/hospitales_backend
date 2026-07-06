import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pruebas')
export class Prueba {
  @PrimaryGeneratedColumn({ name: 'id_prueba' })
  idPrueba: number;

  @Column({ type: 'text' })
  nombre: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  instrucciones: string | null;
}
