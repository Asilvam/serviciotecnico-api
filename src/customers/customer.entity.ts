import {
  Entity,
  ObjectIdColumn,
  Column,
  CreateDateColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { Transform } from 'class-transformer';
import { ObjectId } from 'mongodb';

@Entity('customers')
export class Customer {
  @ObjectIdColumn()
  @Transform(({ value }: { value: ObjectId }) => value?.toHexString?.(), {
    toPlainOnly: true,
  })
  _id?: ObjectId;

  get id(): string | undefined {
    return this._id?.toHexString();
  }

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Index('IDX_CUSTOMER_RUT_UNIQUE', { unique: true, sparse: true })
  @Column({ nullable: true })
  rut?: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ default: true })
  isActive: boolean = true;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
