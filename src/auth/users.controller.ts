import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { UserRole } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  private ensureAdmin(req: Request): void {
    const user = (req as Request & { user?: { role?: string } }).user;
    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo admin puede gestionar usuarios');
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create user (admin only)' })
  create(@Body() createUserDto: CreateUserDto, @Req() req: Request) {
    this.ensureAdmin(req);
    return this.authService.createUser(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users (admin only)' })
  findAll(@Req() req: Request) {
    this.ensureAdmin(req);
    return this.authService.findAllUsers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    this.ensureAdmin(req);
    return this.authService.findUserById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user (admin only)' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Req() req: Request) {
    this.ensureAdmin(req);
    return this.authService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate user (admin only)' })
  remove(@Param('id') id: string, @Req() req: Request) {
    this.ensureAdmin(req);
    return this.authService.removeUser(id);
  }
}
