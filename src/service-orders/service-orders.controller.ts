import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { ServiceOrderStatus } from './service-order.entity';

@ApiTags('service-orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new service order' })
  create(@Body() createServiceOrderDto: CreateServiceOrderDto) {
    return this.serviceOrdersService.create(createServiceOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all service orders' })
  @ApiQuery({ name: 'status', enum: ServiceOrderStatus, required: false })
  @ApiQuery({ name: 'customerId', type: String, required: false })
  findAll(
    @Query('status') status?: ServiceOrderStatus,
    @Query('customerId') customerId?: string,
  ) {
    if (status) {
      return this.serviceOrdersService.findByStatus(status);
    }
    if (customerId) {
      return this.serviceOrdersService.findByCustomer(customerId);
    }
    return this.serviceOrdersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service order by ID' })
  findOne(@Param('id') id: string) {
    return this.serviceOrdersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update service order' })
  update(
    @Param('id') id: string,
    @Body() updateServiceOrderDto: UpdateServiceOrderDto,
  ) {
    return this.serviceOrdersService.update(id, updateServiceOrderDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel service order' })
  cancel(@Param('id') id: string) {
    return this.serviceOrdersService.cancel(id);
  }
}
