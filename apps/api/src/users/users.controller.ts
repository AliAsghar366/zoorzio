import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Return user profile' })
  async getProfile(@Request() req: any) {
    return this.usersService.findById(req.user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateProfile(
    @Request() req: any,
    @Body() body: { name?: string; phone?: string; avatar?: string; location?: string; timezone?: string; language?: string },
  ) {
    return this.usersService.update(req.user.id, body);
  }

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get user preferences' })
  @ApiResponse({ status: 200, description: 'Return user preferences' })
  async getPreferences(@Request() req: any) {
    return this.usersService.getPreferences(req.user.id);
  }

  @Put('me/preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  async updatePreferences(
    @Request() req: any,
    @Body() body: { aiTone?: string; notifications?: any; privacy?: any },
  ) {
    return this.usersService.updatePreferences(req.user.id, body);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'Return user statistics' })
  async getStats(@Request() req: any) {
    return this.usersService.getStats(req.user.id);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete current user' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  async deleteAccount(@Request() req: any) {
    return this.usersService.delete(req.user.id);
  }
}
