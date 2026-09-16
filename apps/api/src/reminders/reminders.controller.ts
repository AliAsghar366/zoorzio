import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

@ApiTags('reminders')
@ApiBearerAuth()
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a reminder' })
  @ApiResponse({ status: 201, description: 'Reminder created' })
  create(@Request() req: any, @Body() dto: CreateReminderDto) {
    return this.remindersService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List reminders' })
  @ApiResponse({ status: 200, description: 'List of reminders' })
  findAll(@Request() req: any, @Query('upcomingOnly') upcomingOnly?: string) {
    return this.remindersService.findAll(req.user.id, upcomingOnly === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a reminder by id' })
  @ApiResponse({ status: 200, description: 'Reminder found' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.remindersService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a reminder' })
  @ApiResponse({ status: 200, description: 'Reminder updated' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateReminderDto) {
    return this.remindersService.update(req.user.id, id, dto);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark a reminder as complete' })
  @ApiResponse({ status: 200, description: 'Reminder marked complete' })
  complete(@Request() req: any, @Param('id') id: string) {
    return this.remindersService.complete(req.user.id, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a reminder so it never fires again' })
  @ApiResponse({ status: 200, description: 'Reminder cancelled' })
  cancel(@Request() req: any, @Param('id') id: string) {
    return this.remindersService.cancel(req.user.id, id);
  }

  @Patch(':id/snooze')
  @ApiOperation({ summary: 'Push a reminder back so it fires again later' })
  @ApiResponse({ status: 200, description: 'Reminder snoozed' })
  snooze(@Request() req: any, @Param('id') id: string, @Body() body: { minutes?: number }) {
    const minutes = typeof body?.minutes === 'number' && body.minutes > 0 ? body.minutes : 60;
    return this.remindersService.snooze(req.user.id, id, minutes * 60 * 1000);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a reminder' })
  @ApiResponse({ status: 200, description: 'Reminder deleted' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.remindersService.remove(req.user.id, id);
  }
}
