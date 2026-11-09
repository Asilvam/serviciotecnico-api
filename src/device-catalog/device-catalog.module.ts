import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceBrand, DeviceModel } from './catalog.entity';
import { DeviceCatalogService } from './device-catalog.service';
import { DeviceCatalogController } from './device-catalog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceBrand, DeviceModel])],
  providers: [DeviceCatalogService],
  controllers: [DeviceCatalogController],
  exports: [DeviceCatalogService],
})
export class DeviceCatalogModule {}
