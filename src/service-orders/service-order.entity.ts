import {
  Entity,
  ObjectIdColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Transform } from 'class-transformer';
import { ObjectId } from 'mongodb';

export enum ServiceOrderStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  WAITING_PARTS = 'waiting_parts',
  COMPLETED = 'completed',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum ServiceOrderPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export class ServiceOrderItem {
  @Column()
  productId: string;

  @Column()
  productName: string;

  @Column()
  unitPrice: number;

  @Column({ default: 1 })
  quantity: number;
}

@Entity('service_orders')
export class ServiceOrder {
  @ObjectIdColumn()
  @Transform(({ value }: { value: ObjectId }) => value?.toHexString?.(), {
    toPlainOnly: true,
  })
  _id?: ObjectId;

  get id(): string | undefined {
    return this._id?.toHexString();
  }

  @Column({ unique: true })
  orderNumber: string;

  @Column()
  customerId: string;

  @Column({ nullable: true })
  technicianId: string;

  @Column()
  deviceType: string;

  @Column()
  deviceBrand: string;

  @Column({ nullable: true })
  deviceModel: string;

  @Column({ nullable: true })
  serialNumber: string;

  @Column({ type: 'text' })
  problemDescription: string;

  @Column({ type: 'text', nullable: true })
  diagnosis: string;

  @Column({ type: 'text', nullable: true })
  workDone: string;

  @Column({ type: 'text', default: ServiceOrderStatus.PENDING })
  status: ServiceOrderStatus;

  @Column({ type: 'text', default: ServiceOrderPriority.MEDIUM })
  priority: ServiceOrderPriority;

  @Column({ default: 0 })
  laborCost: number;

  @Column({ default: 0 })
  partsCost: number;

  @Column({ default: 0 })
  totalCost: number;

  @Column()
  items: ServiceOrderItem[];

  @Column({ nullable: true })
  estimatedDelivery: Date;

  @Column({ nullable: true })
  deliveredAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
