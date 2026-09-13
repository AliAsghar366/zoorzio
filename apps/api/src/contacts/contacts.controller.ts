import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a contact' })
  @ApiResponse({ status: 201, description: 'Contact created' })
  create(@Request() req: any, @Body() dto: CreateContactDto) {
    return this.contactsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List your contacts, optionally filtered by name' })
  @ApiResponse({ status: 200, description: 'List of contacts' })
  findAll(@Request() req: any, @Query('search') search?: string) {
    return search
      ? this.contactsService.search(req.user.id, search)
      : this.contactsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a contact by id' })
  @ApiResponse({ status: 200, description: 'Contact found' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.contactsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a contact' })
  @ApiResponse({ status: 200, description: 'Contact updated' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a contact' })
  @ApiResponse({ status: 200, description: 'Contact deleted' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.contactsService.remove(req.user.id, id);
  }
}
