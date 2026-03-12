import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { Technician } from '../technicians/technician.entity';

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

@Entity('service_order_items')
export class ServiceOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  serviceOrderId: number;

  @Column()
  productId: number;

  @Column()
  productName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ default: 1 })
  quantity: number;
}

@Entity('service_orders')
export class ServiceOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  orderNumber: string;

  @Column()
  customerId: number;

  @ManyToOne(() => Customer, { eager: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ nullable: true })
  technicianId: number;

  @ManyToOne(() => Technician, { eager: true, nullable: true })
  @JoinColumn({ name: 'technicianId' })
  technician: Technician;

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

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  laborCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  partsCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCost: number;

  @OneToMany(() => ServiceOrderItem, (item) => item.serviceOrderId, {
    cascade: true,
    eager: true,
  })
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
