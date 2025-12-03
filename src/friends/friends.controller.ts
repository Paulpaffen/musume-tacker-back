import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { FriendsService } from './friends.service';

@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  async listFriends() {
    // Stub: return empty list for now
    return { friends: [] };
  }

  @Get('requests')
  async listRequests() {
    // Stub: return empty list for now
    return { requests: [] };
  }

  @Post('add')
  async addFriend(@Body() body: { friendCode: string }) {
    // Stub: accept payload and return pending status
    return { status: 'PENDING', target: body.friendCode };
  }

  @Patch(':id/accept')
  async accept(@Param('id') id: string) {
    // Stub: accept by id
    return { id, status: 'ACCEPTED' };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    // Stub: remove friendship/request
    return { id, removed: true };
  }
}
