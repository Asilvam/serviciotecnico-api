import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UserRole } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN) // Toda gestión de usuarios está protegida para administradores
@Controller('users')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @ApiOperation({ summary: 'Create user (admin only)' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.authService.createUser(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users (admin only)' })
  findAll() {
    return this.authService.findAllUsers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  findOne(@Param('id') id: string) {
    return this.authService.findUserById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user (admin only)' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.authService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate user (admin only)' })
  remove(@Param('id') id: string) {
    return this.authService.removeUser(id);
  }
}
