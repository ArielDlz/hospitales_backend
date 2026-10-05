import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';
import { EvaluationFlowStep } from './evaluation-flow-step.entity';
import { Ronda } from './ronda.entity';

@Entity('aspirantes')
@Index(
  'uk_aspirantes_tenant_email_registro_ronda',
  ['tenantId', 'email', 'registroHospital', 'rondaEvaluacionId'],
  { unique: true, where: '"ronda_evaluacion_id" IS NOT NULL' },
)
@Index(
  'uk_aspirantes_tenant_email_registro_sin_ronda',
  ['tenantId', 'email', 'registroHospital'],
  { unique: true, where: '"ronda_evaluacion_id" IS NULL' },
)
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
  especialidad: string | null;

  @Column({ type: 'text', nullable: true })
  nacionalidad: string | null;

  @Column({ type: 'text', nullable: true })
  rfc: string | null;

  @Column({ type: 'text', nullable: true })
  documento: string | null;

  @Column({ type: 'text', nullable: true })
  genero: string | null;

  @Column({ type: 'date', nullable: true, name: 'fecha_nacimiento' })
  fechaNacimiento: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true, name: 'primer_acceso_token' })
  primerAccesoToken: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'primer_acceso_expira' })
  primerAccesoExpira: Date | null;

  @Column({ name: 'evaluation_flow_id', type: 'integer' })
  evaluationFlowId: number;

  @ManyToOne(() => EvaluationFlowStep)
  @JoinColumn({ name: 'evaluation_flow_id' })
  evaluationFlowStep?: EvaluationFlowStep;

  @Column({ name: 'id_evaluador_asignado', type: 'uuid', nullable: true })
  idEvaluadorAsignado: string | null;

  @Column({ name: 'evaluacion_asignada_at', type: 'timestamptz', nullable: true })
  evaluacionAsignadaAt: Date | null;

  @Column({ name: 'veredicto_informe', type: 'text', nullable: true })
  veredictoInforme: string | null;

  @Column({ type: 'text', nullable: true, name: 'google_drive_file_id' })
  googleDriveFileId: string | null;

  @Column({ type: 'text', nullable: true, name: 'google_drive_file_url' })
  googleDriveFileUrl: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
    name: 'enviado_al_hospital_at',
  })
  enviadoAlHospitalAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'stripe_customer_id' })
  stripeCustomerId: string | null;

  @Column({ type: 'text', nullable: true, name: 'payment_link' })
  paymentLink: string | null;

  @Column({ type: 'text', nullable: true, name: 'payment_reference' })
  paymentReference: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'claimed_at' })
  claimedAt: Date | null;

  @Column({ type: 'uuid', name: 'ronda_evaluacion_id', nullable: true })
  rondaEvaluacionId: string | null;

  @ManyToOne(() => Ronda)
  @JoinColumn({ name: 'ronda_evaluacion_id' })
  rondaEvaluacion?: Ronda;
}
