import { IsEmail, IsString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsChileanRut,
  normalizeChileanRut,
} from '../../common/chilean-rut.util';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '12.345.678-5' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeChileanRut(value) : value,
  )
  @IsChileanRut()
  rut: string;

  @ApiPropertyOptional({ example: '+56912345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Av. Providencia 123, Santiago' })
  @IsOptional()
  @IsString()
  address?: string;
}
