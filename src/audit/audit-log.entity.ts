import { Entity, ObjectIdColumn, Column, CreateDateColumn } from 'typeorm';
import { Transform } from 'class-transformer';
import { ObjectId } from 'mongodb';

@Entity('audit_logs')
export class AuditLog {
  @ObjectIdColumn()
  @Transform(({ value }: { value: ObjectId }) => value?.toHexString?.(), {
    toPlainOnly: true,
  })
  _id?: ObjectId;

  get id(): string | undefined {
    return this._id?.toHexString();
  }

  @Column()
  action: string;

  @Column()
  entity: string;

  @Column()
  entityId: string;

  @Column({ nullable: true })
  userId?: string;

  @Column({ nullable: true })
  userEmail?: string;

  @Column({ nullable: true })
  userRole?: string;

  @Column({ nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
