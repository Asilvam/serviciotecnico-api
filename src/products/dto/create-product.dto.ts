import { IsString, IsOptional, IsNumber, Min, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ example: 'Pantalla LCD 15"' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Pantalla LCD para laptops de 15 pulgadas' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'LCD-15-001' })
  @IsString()
  sku: string;

  @ApiProperty({ example: 25000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ example: 10, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;
}
