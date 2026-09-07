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
import { MemoryService } from './memory.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { QueryMemoryDto } from './dto/query-memory.dto';
import { CreateVoiceMemoryDto } from './dto/create-voice-memory.dto';

@ApiTags('Memory')
@ApiBearerAuth()
@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new memory' })
  @ApiResponse({ status: 201, description: 'Memory created successfully' })
  async create(@Request() req: any, @Body() createMemoryDto: CreateMemoryDto) {
    return this.memoryService.create(req.user.id, createMemoryDto);
  }

  @Post('voice')
  @ApiOperation({ summary: 'Transcribe a recorded voice note and save it as a memory' })
  @ApiResponse({ status: 201, description: 'Voice memory created successfully' })
  async createFromVoice(@Request() req: any, @Body() body: CreateVoiceMemoryDto) {
    return this.memoryService.createFromVoice(req.user.id, body.audioBase64, body.tags);
  }

  @Get()
  @ApiOperation({ summary: 'Get all memories' })
  @ApiResponse({ status: 200, description: 'Return all memories' })
  async findAll(@Request() req: any, @Query() query: QueryMemoryDto) {
    return this.memoryService.findAll(req.user.id, query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search memories' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results' })
  @ApiResponse({ status: 200, description: 'Return search results' })
  async search(
    @Request() req: any,
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ) {
    return this.memoryService.search(req.user.id, query, limit || 10);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent memories' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results' })
  @ApiResponse({ status: 200, description: 'Return recent memories' })
  async getRecent(@Request() req: any, @Query('limit') limit?: number) {
    return this.memoryService.getRecentMemories(req.user.id, limit || 10);
  }

  @Get('frequent')
  @ApiOperation({ summary: 'Get frequently accessed memories' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results' })
  @ApiResponse({ status: 200, description: 'Return frequently accessed memories' })
  async getFrequent(@Request() req: any, @Query('limit') limit?: number) {
    return this.memoryService.getFrequentlyAccessed(req.user.id, limit || 10);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get memory statistics' })
  @ApiResponse({ status: 200, description: 'Return memory statistics' })
  async getStats(@Request() req: any) {
    return this.memoryService.getMemoryStats(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get memory by ID' })
  @ApiResponse({ status: 200, description: 'Return memory' })
  @ApiResponse({ status: 404, description: 'Memory not found' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.memoryService.findOne(req.user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update memory' })
  @ApiResponse({ status: 200, description: 'Memory updated successfully' })
  @ApiResponse({ status: 404, description: 'Memory not found' })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateMemoryDto: UpdateMemoryDto,
  ) {
    return this.memoryService.update(req.user.id, id, updateMemoryDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete memory' })
  @ApiResponse({ status: 200, description: 'Memory deleted successfully' })
  @ApiResponse({ status: 404, description: 'Memory not found' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.memoryService.remove(req.user.id, id);
  }
}
