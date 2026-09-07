import { Controller, Get, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BriefingService } from './briefing.service';

@ApiTags('briefing')
@ApiBearerAuth()
@Controller('briefing')
export class BriefingController {
  constructor(private readonly briefingService: BriefingService) {}

  @Get()
  @ApiOperation({ summary: 'Get an on-demand daily briefing (due/overdue tasks + today\'s events)' })
  @ApiResponse({ status: 200, description: 'Briefing generated' })
  generate(@Request() req: any) {
    return this.briefingService.generate(req.user.id);
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Get an on-demand weekly briefing (due/overdue tasks + this week\'s events)' })
  @ApiResponse({ status: 200, description: 'Weekly briefing generated' })
  generateWeekly(@Request() req: any) {
    return this.briefingService.generateWeekly(req.user.id);
  }
}
