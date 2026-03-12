import { IsString, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ServiceOrderStatus, ServiceOrderPriority } from '../service-order.entity';

export class UpdateServiceOrderDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  technicianId?: number;

  @ApiPropertyOptional({ example: 'Se diagnosticó falla en placa base' })
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional({ example: 'Se reemplazó placa base' })
  @IsOptional()
  @IsString()
  workDone?: string;

  @ApiPropertyOptional({ enum: ServiceOrderStatus })
  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  status?: ServiceOrderStatus;

  @ApiPropertyOptional({ enum: ServiceOrderPriority })
  @IsOptional()
  @IsEnum(ServiceOrderPriority)
  priority?: ServiceOrderPriority;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  laborCost?: number;

  @ApiPropertyOptional({ example: '2025-01-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  estimatedDelivery?: string;
}
