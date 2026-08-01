import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ObjectIdColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ObjectId } from 'mongodb';
import type {
  PrinterProfile,
  PrintJobStatus,
} from './interfaces/print-ticket-result.interface';

@Entity('print_jobs')
@Index('IDX_print_jobs_job_id', ['jobId'], { unique: true })
@Index('IDX_print_jobs_expires_at', ['expiresAt'], { expireAfterSeconds: 0 })
export class PrintJob {
  @ObjectIdColumn()
  _id?: ObjectId;

  @Column()
  jobId: string;

  @Column()
  printerId: string;

  @Column()
  printerProfile: PrinterProfile;

  @Column()
  orderId: string;

  @Column()
  orderNumber: string;

  @Column()
  status: PrintJobStatus;

  @Column()
  queuedAt: Date;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  errorCode?: string;

  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ nullable: true })
  warnings?: string[];

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
