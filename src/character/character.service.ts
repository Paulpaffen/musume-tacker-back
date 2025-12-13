import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

@Injectable()
export class CharacterService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createCharacterDto: CreateCharacterDto) {
    const { skills, ...rest } = createCharacterDto;
    return this.prisma.characterTraining.create({
      data: {
        ...rest,
        userId,
        skills: skills ? (skills as any) : undefined, // Convert DTO to plain JSON
      },
    });
  }

  async findAll(
    userId: string,
    filters?: {
      name?: string;
      minRuns?: number;
      maxRuns?: number;
      includeArchived?: boolean;
    },
  ) {
    const where: any = { userId };

    if (filters?.name) {
      where.characterName = {
        contains: filters.name,
        mode: 'insensitive',
      };
    }

    if (!filters?.includeArchived) {
      where.isArchived = false;
    }

    // Prisma doesn't support filtering by relation count directly in the top-level where clause easily in all versions without 'relationLoadStrategy' or raw queries,
    // but we can use the 'every/some/none' or just filter in memory if the dataset is small.
    // However, a better approach for count filtering is usually to use aggregation or just fetch and filter.
    // Given this is likely a small app, fetching and filtering in memory is acceptable for "minRuns/maxRuns".
    // Alternatively, we can use:
    /*
    where.runs = {
       _count: {
         gte: filters.minRuns
       }
    }
    */
    // But this syntax depends on Prisma version. Let's try the standard way if supported, or fallback to in-memory.
    // Actually, let's stick to simple in-memory filtering for the count to be safe and robust.

    const characters = await this.prisma.characterTraining.findMany({
      where,
      include: {
        _count: {
          select: { runs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (filters?.minRuns !== undefined || filters?.maxRuns !== undefined) {
      return characters.filter((char) => {
        const count = char._count.runs;
        if (filters.minRuns !== undefined && count < filters.minRuns) return false;
        if (filters.maxRuns !== undefined && count > filters.maxRuns) return false;
        return true;
      });
    }

    return characters;
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

    const { skills, ...rest } = updateCharacterDto;
    return this.prisma.characterTraining.update({
      where: { id },
      data: {
        ...rest,
        skills: skills ? (skills as any) : undefined, // Convert DTO to plain JSON
      },
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
      where: {
        userId,
        isArchived: false,
      } as any,
      select: {
        id: true,
        characterName: true,
        identifierVersion: true,
      },
    });

    const detectedLower = detectedName.toLowerCase();

    // Filter candidates based on bidirectional inclusion
    const candidates = userCharacters.filter((char) => {
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
