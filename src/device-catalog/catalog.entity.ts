import { Column, Entity, ObjectIdColumn } from 'typeorm';
import { ObjectId } from 'mongodb';

@Entity('device_brands')
export class DeviceBrand {
  @ObjectIdColumn() _id: ObjectId;
  @Column() name: string;
  @Column() normalizedName: string;
  @Column() active: boolean;
  @Column() createdAt: Date;
}
@Entity('device_models')
export class DeviceModel {
  @ObjectIdColumn() _id: ObjectId;
  @Column() brandId: string;
  @Column() name: string;
  @Column() normalizedName: string;
  @Column() category: string;
  @Column() active: boolean;
  @Column() searchKeys: string[];
  @Column() variants: Array<{ deviceCode: string; modelCode: string }>;
  @Column() source: string;
  @Column() createdAt: Date;
}
