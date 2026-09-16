import { Body, Controller, Post, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendChatMessageDto } from './dto/chat.dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: "Send a message to Zoorzio's assistant and get a reply" })
  @ApiResponse({ status: 200, description: 'Assistant reply' })
  async send(@Request() req: any, @Body() dto: SendChatMessageDto) {
    const reply = await this.chatService.reply(req.user.id, dto.messages, req.user.name);
    return { reply };
  }
}
