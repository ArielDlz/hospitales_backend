import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('evaluation_flow_steps')
export class EvaluationFlowStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'integer' })
  orderId: number;

  @Column({ type: 'text' })
  descripcion: string;
}
