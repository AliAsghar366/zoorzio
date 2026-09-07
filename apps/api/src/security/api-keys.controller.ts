import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RequireJwtGuard } from '../common/guards/require-jwt.guard';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(RequireJwtGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new API key (the raw key is only ever shown in this response)' })
  @ApiResponse({ status: 201, description: 'API key created' })
  create(@Request() req: any, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List your API keys (never returns the raw key)' })
  @ApiResponse({ status: 200, description: 'List of API keys' })
  list(@Request() req: any) {
    return this.apiKeysService.list(req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  revoke(@Request() req: any, @Param('id') id: string) {
    return this.apiKeysService.revoke(req.user.id, id);
  }
}
