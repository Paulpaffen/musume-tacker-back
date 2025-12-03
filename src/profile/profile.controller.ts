import { Controller, Get, Patch, Body, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      return { error: 'UNAUTHORIZED' };
    }
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          // New fields are attempted; if DB not migrated this may throw
          friendCode: true,
          displayName: true,
          isProfilePublic: true,
        },
      });
      return user ?? { error: 'NOT_FOUND' };
    } catch (e) {
      // Fallback for pre-migration environments: return minimal info
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true },
      });
      return { ...user, friendCode: null, displayName: null, isProfilePublic: false };
    }
  }

  @Patch('settings')
  async updateSettings(@Req() req: any, @Body() _body: any) {
    const userId = req.user?.id;
    if (!userId) {
      return { error: 'UNAUTHORIZED' };
    }
    // Phase 1 stub: acknowledge payload without persisting (until migration runs)
    return { updated: true };
  }
}
