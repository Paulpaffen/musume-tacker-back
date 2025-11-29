import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

@Injectable()
export class CharacterService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createCharacterDto: CreateCharacterDto) {
    return this.prisma.characterTraining.create({
      data: {
        ...createCharacterDto,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.characterTraining.findMany({
      where: { userId },
      include: {
        _count: {
          select: { runs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const character = await this.prisma.characterTraining.findUnique({
      where: { id },
      include: {
        runs: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        _count: {
          select: { runs: true },
        },
      },
    });

    if (!character) {
      throw new NotFoundException('Character not found');
    }

    if (character.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return character;
  }

  async update(id: string, userId: string, updateCharacterDto: UpdateCharacterDto) {
    const character = await this.prisma.characterTraining.findUnique({
      where: { id },
    });

    if (!character) {
      throw new NotFoundException('Character not found');
    }

    if (character.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.characterTraining.update({
      where: { id },
      data: updateCharacterDto,
    });
  }

  async remove(id: string, userId: string) {
    const character = await this.prisma.characterTraining.findUnique({
      where: { id },
    });

    if (!character) {
      throw new NotFoundException('Character not found');
    }

    if (character.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.characterTraining.delete({
      where: { id },
    });

    return { message: 'Character deleted successfully' };
  }

  async findCandidates(userId: string, detectedName: string) {
    // Partial match, case-insensitive
    return this.prisma.characterTraining.findMany({
      where: {
        userId,
        characterName: {
          contains: detectedName,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        characterName: true,
        identifierVersion: true,
      },
      take: 10,
    });
  }
}
