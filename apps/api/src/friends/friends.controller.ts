import { Controller, Get, Post, Delete, Param, Body, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { SendFriendReminderDto } from './dto/send-friend-reminder.dto';

@ApiTags('friends')
@ApiBearerAuth()
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  @ApiOperation({ summary: 'List your accepted friends' })
  @ApiResponse({ status: 200, description: 'List of friends' })
  listFriends(@Request() req: any) {
    return this.friendsService.listFriends(req.user.id);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List incoming pending friend requests' })
  @ApiResponse({ status: 200, description: 'List of pending requests' })
  listRequests(@Request() req: any) {
    return this.friendsService.listIncomingRequests(req.user.id);
  }

  @Get('quota')
  @ApiOperation({ summary: 'Get your current friend/reminder quota usage' })
  @ApiResponse({ status: 200, description: 'Quota usage' })
  getQuota(@Request() req: any) {
    return this.friendsService.getQuota(req.user.id);
  }

  @Get('reminders')
  @ApiOperation({ summary: 'List reminders friends have sent you' })
  @ApiResponse({ status: 200, description: 'List of received friend reminders' })
  listReceivedReminders(@Request() req: any) {
    return this.friendsService.listReceivedReminders(req.user.id);
  }

  @Post('request')
  @ApiOperation({ summary: 'Send a friend request by email' })
  @ApiResponse({ status: 201, description: 'Friend request sent' })
  sendRequest(@Request() req: any, @Body() dto: SendFriendRequestDto) {
    return this.friendsService.sendRequest(req.user.id, dto);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept a pending friend request' })
  @ApiResponse({ status: 200, description: 'Friend request accepted' })
  accept(@Request() req: any, @Param('id') id: string) {
    return this.friendsService.respond(req.user.id, id, true);
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Decline a pending friend request' })
  @ApiResponse({ status: 200, description: 'Friend request declined' })
  decline(@Request() req: any, @Param('id') id: string) {
    return this.friendsService.respond(req.user.id, id, false);
  }

  @Post(':friendId/remind')
  @ApiOperation({ summary: 'Send a reminder directly to a friend' })
  @ApiResponse({ status: 201, description: 'Friend reminder sent' })
  remind(@Request() req: any, @Param('friendId') friendId: string, @Body() dto: SendFriendReminderDto) {
    return this.friendsService.sendFriendReminder(req.user.id, friendId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a friend' })
  @ApiResponse({ status: 200, description: 'Friend removed' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.friendsService.remove(req.user.id, id);
  }
}
