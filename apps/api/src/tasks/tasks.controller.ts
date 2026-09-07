import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  async create(@Request() req: any, @Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(req.user.id, createTaskDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tasks' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results' })
  @ApiQuery({ name: 'boardId', required: false, description: 'Filter by board' })
  @ApiResponse({ status: 200, description: 'Return all tasks' })
  async findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('boardId') boardId?: string,
  ) {
    return this.tasksService.findAll(req.user.id, status, limit || 50, boardId);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get tasks due today' })
  @ApiResponse({ status: 200, description: 'Return tasks due today' })
  async getToday(@Request() req: any) {
    return this.tasksService.getTasksDueToday(req.user.id);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Get overdue tasks' })
  @ApiResponse({ status: 200, description: 'Return overdue tasks' })
  async getOverdue(@Request() req: any) {
    return this.tasksService.getOverdueTasks(req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics' })
  @ApiResponse({ status: 200, description: 'Return task statistics' })
  async getStats(@Request() req: any) {
    return this.tasksService.getTaskStats(req.user.id);
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Get task suggestions from memories' })
  @ApiResponse({ status: 200, description: 'Return task suggestions' })
  async getSuggestions(@Request() req: any) {
    return this.tasksService.suggestTasks(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiResponse({ status: 200, description: 'Return task' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.tasksService.findOne(req.user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update task' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(req.user.id, id, updateTaskDto);
  }

  @Put(':id/complete')
  @ApiOperation({ summary: 'Mark task as completed' })
  @ApiResponse({ status: 200, description: 'Task marked as completed' })
  async complete(@Request() req: any, @Param('id') id: string) {
    return this.tasksService.completeTask(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete task' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.tasksService.remove(req.user.id, id);
  }

  @Post(':id/reminder')
  @ApiOperation({ summary: 'Add reminder to task' })
  @ApiResponse({ status: 201, description: 'Reminder added successfully' })
  async addReminder(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { scheduledAt: Date },
  ) {
    return this.tasksService.addReminder(req.user.id, id, body.scheduledAt);
  }
}
