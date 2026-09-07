import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsDateString, MaxLength, MinLength } from 'class-validator';
import { TaskPriority } from '@anchor/database';

export { TaskPriority };

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title', example: 'Buy groceries' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Task description', example: 'Milk, eggs, bread' })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Due date', example: '2024-01-15T10:00:00Z' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Priority', enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Link to memory', example: 'clx1234567890' })
  @IsString()
  @IsOptional()
  memoryId?: string;

  @ApiPropertyOptional({ description: 'Board to add this task to - defaults to your first/default board if omitted' })
  @IsString()
  @IsOptional()
  boardId?: string;
}
