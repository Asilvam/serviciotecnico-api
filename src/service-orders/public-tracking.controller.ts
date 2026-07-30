import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServiceOrdersService } from './service-orders.service';

@ApiTags('tracking')
@Controller('tracking')
export class PublicTrackingController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get the public status of a service order' })
  findByToken(@Param('token') token: string) {
    return this.serviceOrdersService.findPublicTracking(token);
  }
}
