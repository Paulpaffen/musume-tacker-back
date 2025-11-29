import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

@Injectable()
export class CharacterService {
  constructor(private prisma: PrismaService) { }

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
    // Get all user characters to perform fuzzy matching in memory
    const userCharacters = await this.prisma.characterTraining.findMany({
      where: { userId },
      select: {
        id: true,
        characterName: true,
        identifierVersion: true,
      },
    });

    const detectedLower = detectedName.toLowerCase();

    // Filter candidates based on bidirectional inclusion
    const candidates = userCharacters.filter(char => {
      const charNameLower = char.characterName.toLowerCase();

      // Check 1: Detected name contains character name (e.g. "xs Gold Ship !,af" contains "gold ship")
      if (detectedLower.includes(charNameLower)) return true;

      // Check 2: Character name contains detected name (e.g. "Gold Ship" contains "gold")
      // We add a length check to avoid matching very short detected strings like "a" or "s" to everything
      if (detectedLower.length > 2 && charNameLower.includes(detectedLower)) return true;

      return false;
    });

    return candidates.slice(0, 10);
  }
}
