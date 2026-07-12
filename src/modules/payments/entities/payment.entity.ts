import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Aspirante } from '../../aspirante/aspirante.entity';

export enum PaymentStatus {
  Pending = 'pending',
  Paid = 'paid',
  Failed = 'failed',
  Canceled = 'canceled',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'uuid', name: 'aspirante_id', nullable: true })
  aspiranteId: string | null;

  @ManyToOne(() => Aspirante, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'aspirante_id' })
  aspirante?: Aspirante | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'anonymized_at' })
  anonymizedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'stripe_payment_intent_id' })
  stripePaymentIntentId: string | null;

  @Column({ type: 'integer', name: 'amount_cents' })
  amountCents: number;

  @Column({ type: 'text', default: 'mxn' })
  currency: string;

  @Column({ type: 'text', default: PaymentStatus.Pending })
  status: PaymentStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'paid_at' })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
