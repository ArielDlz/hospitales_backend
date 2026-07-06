import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('veredictos')
export class Veredicto {
  @PrimaryGeneratedColumn({ name: 'id_veredicto' })
  idVeredicto: number;

  @Column({ type: 'text', unique: true })
  codigo: string;

  @Column({ type: 'text' })
  etiqueta: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
