import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TechnicianSpecialty } from '../technician.entity';

export class CreateTechnicianDto {
  @ApiProperty({ example: 'Carlos Técnico' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'carlos@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+56987654321' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: TechnicianSpecialty, default: TechnicianSpecialty.GENERAL })
  @IsOptional()
  @IsEnum(TechnicianSpecialty)
  specialty?: TechnicianSpecialty;
}
