import { Body, Controller, Delete, Get, Param, Post, Put, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';

@ApiTags('Boards')
@ApiBearerAuth()
@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get()
  @ApiOperation({ summary: 'List your boards' })
  @ApiResponse({ status: 200, description: 'Your boards, with task counts' })
  list(@Request() req: any) {
    return this.boardsService.list(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new board' })
  @ApiResponse({ status: 201, description: 'Board created' })
  create(@Request() req: any, @Body() dto: CreateBoardDto) {
    return this.boardsService.create(req.user.id, dto.name);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a board and its tasks' })
  @ApiResponse({ status: 200, description: 'The board' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.boardsService.findOne(req.user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Rename a board' })
  @ApiResponse({ status: 200, description: 'Board renamed' })
  rename(@Request() req: any, @Param('id') id: string, @Body() dto: CreateBoardDto) {
    return this.boardsService.rename(req.user.id, id, dto.name);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a board (tasks are kept, unassigned)' })
  @ApiResponse({ status: 200, description: 'Board deleted' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.boardsService.remove(req.user.id, id);
  }
}
