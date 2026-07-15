import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('hospitales')
export class Hospital {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', insert: false })
  uuid: string;

  @Column({ type: 'text' })
  nombre: string;

  @Column({ type: 'text', nullable: true, name: 'logo_url' })
  logoUrl: string | null;

  @Column({ type: 'text' })
  slug: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  /** When false, create aspirante skips invite email; aspirante self-requests activation. */
  @Column({ type: 'boolean', default: true, name: 'envio_correo_registro' })
  envioCorreoRegistro: boolean;

  /** When set, aspirante public entry is blocked before this instant. NULL = no open bound. */
  @Column({ type: 'timestamptz', nullable: true, name: 'acceso_abre_at' })
  accesoAbreAt: Date | null;

  /** When set, aspirante public entry is blocked after this instant. NULL = no close bound. */
  @Column({ type: 'timestamptz', nullable: true, name: 'acceso_cierra_at' })
  accesoCierraAt: Date | null;
}
