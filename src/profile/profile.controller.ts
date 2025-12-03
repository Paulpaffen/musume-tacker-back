import { Controller, Get, Patch, Body, Request, UseGuards, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@Request() req: any) {
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
          friendCode: true,
          displayName: true,
          isProfilePublic: true,
          profileSettings: true,
        },
      });
      return user ?? { error: 'NOT_FOUND' };
    } catch (e) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true },
      });
      return { ...user, friendCode: null, displayName: null, isProfilePublic: false };
    }
  }

  @Patch('settings')
  async updateSettings(@Request() req: any, @Body() body: any) {
    const userId = req.user?.id;
    if (!userId) {
      return { error: 'UNAUTHORIZED' };
    }

    const { displayName, isProfilePublic, ...privacySettings } = body;

    // Update user profile
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: displayName !== undefined ? displayName : undefined,
        isProfilePublic: isProfilePublic !== undefined ? isProfilePublic : undefined,
      },
    });

    // Update or create profile settings
    if (Object.keys(privacySettings).length > 0) {
      await this.prisma.profileSettings.upsert({
        where: { userId },
        create: {
          userId,
          ...privacySettings,
        },
        update: privacySettings,
      });
    }

    return { success: true };
  }

  @Get('user/:friendCode')
  async getPublicProfile(@Request() req: any, @Param('friendCode') friendCode: string) {
    const currentUserId = req.user?.id;

    const user = await this.prisma.user.findUnique({
      where: { friendCode },
      select: {
        id: true,
        username: true,
        displayName: true,
        friendCode: true,
        isProfilePublic: true,
        profileSettings: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Check if they are friends
    const areFriends = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: currentUserId, friendId: user.id, status: 'ACCEPTED' },
          { userId: user.id, friendId: currentUserId, status: 'ACCEPTED' },
        ],
      },
    });

    const settings = user.profileSettings || {
      showStats: true,
      showCharacters: true,
      showBestRuns: true,
      showRecentActivity: true,
    };

    // If not friends and profile is private, return minimal info
    if (!areFriends && !user.isProfilePublic) {
      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        friendCode: user.friendCode,
        isPrivate: true,
      };
    }

    // Return full profile based on settings
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      friendCode: user.friendCode,
      settings,
      areFriends: !!areFriends,
    };
  }

  @Get('user/:friendCode/stats')
  async getUserStats(@Request() req: any, @Param('friendCode') friendCode: string) {
    const currentUserId = req.user?.id;

    const user = await this.prisma.user.findUnique({
      where: { friendCode },
      select: {
        id: true,
        isProfilePublic: true,
        profileSettings: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const areFriends = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: currentUserId, friendId: user.id, status: 'ACCEPTED' },
          { userId: user.id, friendId: currentUserId, status: 'ACCEPTED' },
        ],
      },
    });

    const settings = user.profileSettings || { showStats: true };

    if (!areFriends && !user.isProfilePublic) {
      throw new NotFoundException('Perfil privado');
    }

    if (!settings.showStats) {
      throw new NotFoundException('Estadísticas no disponibles');
    }

    // Get user stats
    const totalRuns = await this.prisma.run.count({
      where: { characterTraining: { userId: user.id } },
    });

    const runs = await this.prisma.run.findMany({
      where: { characterTraining: { userId: user.id } },
    });

    const avgScore = runs.length > 0
      ? Math.round(runs.reduce((sum, r) => sum + r.score, 0) / runs.length)
      : 0;

    const avgPlace = runs.length > 0
      ? parseFloat((runs.reduce((sum, r) => sum + r.finalPlace, 0) / runs.length).toFixed(1))
      : 0;

    const rushedRate = runs.length > 0
      ? parseFloat(((runs.filter(r => r.rushed).length / runs.length) * 100).toFixed(1))
      : 0;

    return {
      totalRuns,
      averageScore: avgScore,
      averageFinalPlace: avgPlace,
      rushedRate,
    };
  }

  @Get('user/:friendCode/characters')
  async getUserCharacters(@Request() req: any, @Param('friendCode') friendCode: string) {
    const currentUserId = req.user?.id;

    const user = await this.prisma.user.findUnique({
      where: { friendCode },
      select: {
        id: true,
        isProfilePublic: true,
        profileSettings: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const areFriends = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: currentUserId, friendId: user.id, status: 'ACCEPTED' },
          { userId: user.id, friendId: currentUserId, status: 'ACCEPTED' },
        ],
      },
    });

    const settings = user.profileSettings || { showCharacters: true };

    if (!areFriends && !user.isProfilePublic) {
      throw new NotFoundException('Perfil privado');
    }

    if (!settings.showCharacters) {
      throw new NotFoundException('Personajes no disponibles');
    }

    const characters = await this.prisma.characterTraining.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { runs: true },
        },
      },
      take: 20,
    });

    return { characters };
  }

  @Get('user/:friendCode/best-runs')
  async getUserBestRuns(@Request() req: any, @Param('friendCode') friendCode: string) {
    const currentUserId = req.user?.id;

    const user = await this.prisma.user.findUnique({
      where: { friendCode },
      select: {
        id: true,
        isProfilePublic: true,
        profileSettings: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const areFriends = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: currentUserId, friendId: user.id, status: 'ACCEPTED' },
          { userId: user.id, friendId: currentUserId, status: 'ACCEPTED' },
        ],
      },
    });

    const settings = user.profileSettings || { showBestRuns: true };

    if (!areFriends && !user.isProfilePublic) {
      throw new NotFoundException('Perfil privado');
    }

    if (!settings.showBestRuns) {
      throw new NotFoundException('Mejores carreras no disponibles');
    }

    const bestRuns = await this.prisma.run.findMany({
      where: { characterTraining: { userId: user.id } },
      include: {
        characterTraining: {
          select: {
            characterName: true,
            identifierVersion: true,
          },
        },
      },
      orderBy: { score: 'desc' },
      take: 10,
    });

    return { bestRuns };
  }
}

