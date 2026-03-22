import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UsuarioAdministrativo } from './usuario-administrativo.entity';

@Entity('evaluador_tenant')
export class EvaluadorTenant {
  @PrimaryColumn({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @PrimaryColumn({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => UsuarioAdministrativo, (u) => u.tenantAssignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioAdministrativo;
}
