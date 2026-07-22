import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RolUsuarioAdmin } from '../../../common/enums/rol-usuario-admin.enum';
import { EvaluadorTenant } from './evaluador-tenant.entity';

@Entity('usuarios_administrativos')
export class UsuarioAdministrativo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ type: 'text', name: 'password_hash' })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: RolUsuarioAdmin,
    enumName: 'rol_usuario_admin',
  })
  rol!: RolUsuarioAdmin;

  @Column({ type: 'boolean', name: 'is_superuser', default: false })
  isSuperuser!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'text', nullable: true, default: null })
  nombre!: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  firma!: string | null;

  @Column({
    type: 'text',
    name: 'cedula_profesional',
    nullable: true,
    default: null,
  })
  cedulaProfesional!: string | null;

  @Column({
    type: 'uuid',
    name: 'supervisor_id',
    nullable: true,
    default: null,
  })
  supervisorId!: string | null;

  @ManyToOne(() => UsuarioAdministrativo, (u) => u.supervisees, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'supervisor_id' })
  supervisor!: UsuarioAdministrativo | null;

  @OneToMany(() => UsuarioAdministrativo, (u) => u.supervisor)
  supervisees!: UsuarioAdministrativo[];

  @OneToMany(() => EvaluadorTenant, (et) => et.usuario)
  tenantAssignments!: EvaluadorTenant[];
}
