import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/user.entity';
import { DeviceCatalogService } from './device-catalog.service';
import { CatalogQueryDto } from './catalog.dto';

@ApiTags('device-catalog')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.TECHNICIAN)
@Controller('device-catalog')
export class DeviceCatalogController {
  constructor(private readonly catalog: DeviceCatalogService) {}
  @Get('brands') brands(@Query() query: CatalogQueryDto) {
    return this.catalog.listBrands(query);
  }
  @Get('models') models(@Query() query: CatalogQueryDto) {
    return this.catalog.listModels(query);
  }
  @Get('brands/:id') async brand(@Param('id') id: string) {
    const b = await this.catalog.getBrand(id);
    return { id: b._id.toHexString(), name: b.name, active: b.active };
  }
  @Get('models/:id') async model(@Param('id') id: string) {
    const m = await this.catalog.getModel(id);
    const { _id, ...rest } = m;
    return { ...rest, id: _id.toHexString() };
  }
}
