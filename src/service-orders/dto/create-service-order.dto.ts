import { IsString, IsOptional, IsEnum, IsNumber, IsPositive, IsDateString, IsArray, ValidateNested, Min, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ServiceOrderPriority } from '../service-order.entity';

export class ServiceOrderItemDto {
  @ApiProperty({ example: '67d0f4a5f99f719467f91a11' })
  @IsMongoId()
  productId: string;

  @ApiProperty({ example: 'Pantalla LCD 15"' })
  @IsString()
  productName: string;

  @ApiProperty({ example: 25000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unitPrice: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;
}

export class CreateServiceOrderDto {
  @ApiProperty({ example: '67d0f4a5f99f719467f91a22' })
  @IsMongoId()
  customerId: string;

  @ApiPropertyOptional({ example: '67d0f4a5f99f719467f91a33' })
  @IsOptional()
  @IsMongoId()
  technicianId?: string;

  @ApiProperty({ example: 'Laptop' })
  @IsString()
  deviceType: string;

  @ApiProperty({ example: 'HP' })
  @IsString()
  deviceBrand: string;

  @ApiPropertyOptional({ example: 'Pavilion 15' })
  @IsOptional()
  @IsString()
  deviceModel?: string;

  @ApiPropertyOptional({ example: 'ABC123456' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiProperty({ example: 'El equipo no enciende' })
  @IsString()
  problemDescription: string;

  @ApiPropertyOptional({ enum: ServiceOrderPriority, default: ServiceOrderPriority.MEDIUM })
  @IsOptional()
  @IsEnum(ServiceOrderPriority)
  priority?: ServiceOrderPriority;

  @ApiPropertyOptional({ example: '2025-01-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  estimatedDelivery?: string;

  @ApiPropertyOptional({ type: [ServiceOrderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceOrderItemDto)
  items?: ServiceOrderItemDto[];
}
