import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async addFriend(userId: string, friendCode: string) {
    // Find the friend by friendCode
    const friend = await this.prisma.user.findUnique({
      where: { friendCode },
    });

    if (!friend) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (friend.id === userId) {
      throw new BadRequestException('No puedes agregarte a ti mismo');
    }

    // Check if friendship already exists
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId: friend.id },
          { userId: friend.id, friendId: userId },
        ],
      },
    });

    if (existing) {
      throw new BadRequestException('Ya existe una solicitud o amistad con este usuario');
    }

    // Create friendship request
    const friendship = await this.prisma.friendship.create({
      data: {
        userId,
        friendId: friend.id,
        status: 'PENDING',
      },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            displayName: true,
            friendCode: true,
          },
        },
      },
    });

    return friendship;
  }

  async listFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { userId, status: 'ACCEPTED' },
          { friendId: userId, status: 'ACCEPTED' },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            friendCode: true,
          },
        },
        friend: {
          select: {
            id: true,
            username: true,
            displayName: true,
            friendCode: true,
          },
        },
      },
    });

    // Map to return the other user in the friendship
    return friendships.map((f) => ({
      friendshipId: f.id,
      friend: f.userId === userId ? f.friend : f.user,
      since: f.acceptedAt,
    }));
  }

  async listRequests(userId: string) {
    // Get requests sent TO this user (pending)
    const requests = await this.prisma.friendship.findMany({
      where: {
        friendId: userId,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            friendCode: true,
          },
        },
      },
    });

    return requests.map((r) => ({
      requestId: r.id,
      from: r.user,
      createdAt: r.createdAt,
    }));
  }

  async acceptRequest(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (friendship.friendId !== userId) {
      throw new BadRequestException('No puedes aceptar esta solicitud');
    }

    if (friendship.status !== 'PENDING') {
      throw new BadRequestException('Esta solicitud ya fue procesada');
    }

    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    return updated;
  }

  async removeFriend(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundException('Amistad no encontrada');
    }

    // User can only remove if they are part of the friendship
    if (friendship.userId !== userId && friendship.friendId !== userId) {
      throw new BadRequestException('No puedes eliminar esta amistad');
    }

    await this.prisma.friendship.delete({
      where: { id: friendshipId },
    });

    return { success: true };
  }
}
