import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RolUsuarioAdmin } from '../../../common/enums/rol-usuario-admin.enum';
import { EvaluadorTenant } from './evaluador-tenant.entity';

@Entity('usuarios_administrativos')
export class UsuarioAdministrativo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text', name: 'password_hash' })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: RolUsuarioAdmin,
    enumName: 'rol_usuario_admin',
  })
  rol: RolUsuarioAdmin;

  @Column({ type: 'boolean', name: 'is_superuser', default: false })
  isSuperuser: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @OneToMany(() => EvaluadorTenant, (et) => et.usuario)
  tenantAssignments: EvaluadorTenant[];
}
