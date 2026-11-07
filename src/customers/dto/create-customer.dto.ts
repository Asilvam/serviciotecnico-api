import { formatCustomerName } from '../../common/customer-name.util';
import { IsEmail, IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsChileanRut,
  normalizeChileanRut,
} from '../../common/chilean-rut.util';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? formatCustomerName(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'juan@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '12.345.678-5' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim()
        ? normalizeChileanRut(value)
        : undefined
      : value,
  )
  @IsOptional()
  @IsChileanRut()
  rut?: string;

  @ApiPropertyOptional({ example: '+56912345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Av. Providencia 123, Santiago' })
  @IsOptional()
  @IsString()
  address?: string;
}
