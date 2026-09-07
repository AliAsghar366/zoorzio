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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ListsService } from './lists.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { CreateListItemDto, UpdateListItemDto } from './dto/list-item.dto';

@ApiTags('Lists')
@ApiBearerAuth()
@Controller('lists')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new list' })
  @ApiResponse({ status: 201, description: 'List created successfully' })
  async create(@Request() req: any, @Body() dto: CreateListDto) {
    return this.listsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all lists' })
  @ApiQuery({ name: 'includeArchived', required: false })
  @ApiResponse({ status: 200, description: 'Return all lists' })
  async findAll(@Request() req: any, @Query('includeArchived') includeArchived?: string) {
    return this.listsService.findAll(req.user.id, includeArchived === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get list by ID' })
  @ApiResponse({ status: 200, description: 'Return list with items' })
  @ApiResponse({ status: 404, description: 'List not found' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.listsService.findOne(req.user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update list' })
  @ApiResponse({ status: 200, description: 'List updated successfully' })
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateListDto) {
    return this.listsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete list' })
  @ApiResponse({ status: 200, description: 'List deleted successfully' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.listsService.remove(req.user.id, id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add item to list' })
  @ApiResponse({ status: 201, description: 'Item added successfully' })
  async addItem(@Request() req: any, @Param('id') id: string, @Body() dto: CreateListItemDto) {
    return this.listsService.addItem(req.user.id, id, dto);
  }

  @Put(':id/items/:itemId')
  @ApiOperation({ summary: 'Update list item' })
  @ApiResponse({ status: 200, description: 'Item updated successfully' })
  async updateItem(
    @Request() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateListItemDto,
  ) {
    return this.listsService.updateItem(req.user.id, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remove list item' })
  @ApiResponse({ status: 200, description: 'Item removed successfully' })
  async removeItem(@Request() req: any, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.listsService.removeItem(req.user.id, id, itemId);
  }
}
