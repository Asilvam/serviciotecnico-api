import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TechniciansService } from './technicians.service';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';

@ApiTags('technicians')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('technicians')
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new technician' })
  create(@Body() createTechnicianDto: CreateTechnicianDto) {
    return this.techniciansService.create(createTechnicianDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all technicians' })
  findAll() {
    return this.techniciansService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get technician by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.techniciansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update technician' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTechnicianDto: UpdateTechnicianDto,
  ) {
    return this.techniciansService.update(id, updateTechnicianDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate technician' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.techniciansService.remove(id);
  }
}
