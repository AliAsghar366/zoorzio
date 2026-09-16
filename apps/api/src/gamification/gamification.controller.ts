import { Controller, Get, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GamificationService } from './gamification.service';

@ApiTags('gamification')
@ApiBearerAuth()
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('progress')
  @ApiOperation({ summary: '[Master Zoorzio] Get your achievement progress (X of 21 actions)' })
  @ApiResponse({ status: 200, description: 'Achievement progress' })
  getProgress(@Request() req: any) {
    return this.gamificationService.getProgress(req.user.id);
  }
}
