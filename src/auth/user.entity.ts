import {
  Entity,
  ObjectIdColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Transform } from 'class-transformer';
import { ObjectId } from 'mongodb';

export enum UserRole {
  ADMIN = 'admin',
  TECHNICIAN = 'technician',
  RECEPTIONIST = 'receptionist',
}

@Entity('users')
export class User {
  @ObjectIdColumn()
  @Transform(({ value }: { value: ObjectId }) => value?.toHexString?.(), {
    toPlainOnly: true,
  })
  _id?: ObjectId;

  get id(): string | undefined {
    return this._id?.toHexString();
  }

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ type: 'text', default: UserRole.RECEPTIONIST })
  role: UserRole = UserRole.RECEPTIONIST;

  @Column({ default: true })
  isActive: boolean = true;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
