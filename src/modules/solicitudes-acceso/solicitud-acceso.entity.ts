import { Column, Entity } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('solicitudes_acceso')
export class SolicitudAcceso extends TenantBaseEntity {
  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text' })
  nombre: string;

  @Column({ type: 'text' })
  apellidos: string;

  @Column({ type: 'text', name: 'registro_hospital' })
  registroHospital: string;

  @Column({ type: 'text' })
  telefono: string;

  @Column({ type: 'text', nullable: true })
  comentario: string | null;

  @Column({ type: 'text', default: 'pendiente' })
  estado: string;
}
