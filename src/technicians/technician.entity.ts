import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TechnicianSpecialty {
  ELECTRONICS = 'electronics',
  COMPUTING = 'computing',
  APPLIANCES = 'appliances',
  GENERAL = 'general',
}

@Entity('technicians')
export class Technician {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'text', default: TechnicianSpecialty.GENERAL })
  specialty: TechnicianSpecialty;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
