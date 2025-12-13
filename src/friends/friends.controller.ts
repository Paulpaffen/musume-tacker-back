import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async listFriends(@Request() req: any) {
    const friends = await this.friendsService.listFriends(req.user.id);
    return { friends };
  }

  @Get('requests')
  async listRequests(@Request() req: any) {
    const requests = await this.friendsService.listRequests(req.user.id);
    return { requests };
  }

  @Post('add')
  async addFriend(@Request() req: any, @Body() body: { friendCode: string }) {
    const friendship = await this.friendsService.addFriend(req.user.id, body.friendCode);
    return { friendship };
  }

  @Patch(':id/accept')
  async accept(@Request() req: any, @Param('id') id: string) {
    const friendship = await this.friendsService.acceptRequest(req.user.id, id);
    return { friendship };
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.friendsService.removeFriend(req.user.id, id);
  }

  @Get('debug')
  async debugFriends(@Request() req: any) {
    const userId = req.user?.id;
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { userId, status: 'ACCEPTED' },
          { friendId: userId, status: 'ACCEPTED' },
        ],
      },
      include: {
        user: true,
        friend: true,
      },
    });
    return { userId, friendships };
  }
}
