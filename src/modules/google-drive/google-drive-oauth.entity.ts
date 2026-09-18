import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('google_drive_oauth')
export class GoogleDriveOauth {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', name: 'refresh_token' })
  refreshToken: string;

  @Column({ type: 'text', name: 'google_email', nullable: true })
  googleEmail: string | null;

  @Column({ type: 'uuid', name: 'connected_by_user_id', nullable: true })
  connectedByUserId: string | null;

  @CreateDateColumn({ name: 'connected_at' })
  connectedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
