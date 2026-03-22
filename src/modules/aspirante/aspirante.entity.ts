import { Column, Entity, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('aspirantes')
@Unique(['tenantId', 'email', 'registroHospital'])
export class Aspirante extends TenantBaseEntity {
  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text', name: 'registro_hospital' })
  registroHospital: string;

  @Column({ type: 'text', name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'text' })
  apellidos: string;

  @Column({ type: 'text' })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  telefono: string | null;

  @Column({ type: 'text', nullable: true })
  modalidad: string | null;

  @Column({ type: 'text', nullable: true })
  documento: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true, name: 'primer_acceso_token' })
  primerAccesoToken: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'primer_acceso_expira' })
  primerAccesoExpira: Date | null;
}
