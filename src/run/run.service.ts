import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRunDto } from './dto/create-run.dto';
import { UpdateRunDto } from './dto/update-run.dto';

@Injectable()
export class RunService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createRunDto: CreateRunDto) {
    // Verify character belongs to user
    const character = await this.prisma.characterTraining.findUnique({
      where: { id: createRunDto.characterTrainingId },
    });

    if (!character) {
      throw new NotFoundException('Character not found');
    }

    if (character.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.run.create({
      data: {
        ...createRunDto,
        date: createRunDto.date ? new Date(createRunDto.date) : new Date(),
      },
      include: {
        characterTraining: {
          select: {
            characterName: true,
            identifierVersion: true,
          },
        },
      },
    });
  }

  async findAll(
    userId: string,
    filters: {
      characterTrainingId?: string;
      trackType?: string;
      startDate?: string;
      endDate?: string;
      minPlace?: number;
      maxPlace?: number;
      minScore?: number;
      maxScore?: number;
      rareSkills?: number;
      normalSkills?: number;
      rushed?: boolean;
      goodPositioning?: boolean;
      uniqueSkillActivated?: boolean;
      includeArchived?: boolean;
    },
  ) {
    // Build where clause
    const where: any = {};

    // Filter by character(s)
    if (filters.characterTrainingId) {
      // Verify character belongs to user
      const character = await this.prisma.characterTraining.findUnique({
        where: { id: filters.characterTrainingId },
      });

      if (!character) {
        throw new NotFoundException('Character not found');
      }

      if (character.userId !== userId) {
        throw new ForbiddenException('Access denied');
      }

      where.characterTrainingId = filters.characterTrainingId;
    } else {
      // Get all runs for all user's characters (excluding archived by default)
      const userCharacters = await this.prisma.characterTraining.findMany({
        where: {
          userId,
          isArchived: filters.includeArchived ? undefined : false,
        } as any,
        select: { id: true },
      });

      where.characterTrainingId = {
        in: userCharacters.map((c) => c.id),
      };
    }

    // Track type filter
    if (filters.trackType) {
      where.trackType = filters.trackType;
    }

    // Date filters
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    // Place filters
    if (filters.minPlace !== undefined || filters.maxPlace !== undefined) {
      where.finalPlace = {};
      if (filters.minPlace !== undefined) where.finalPlace.gte = filters.minPlace;
      if (filters.maxPlace !== undefined) where.finalPlace.lte = filters.maxPlace;
    }

    // Score filters
    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      where.score = {};
      if (filters.minScore !== undefined) where.score.gte = filters.minScore;
      if (filters.maxScore !== undefined) where.score.lte = filters.maxScore;
    }

    // Skills filters
    if (filters.rareSkills !== undefined) where.rareSkillsCount = { gte: filters.rareSkills };
    if (filters.normalSkills !== undefined) where.normalSkillsCount = { gte: filters.normalSkills };

    // Status filters
    if (filters.rushed !== undefined) where.rushed = filters.rushed;
    if (filters.goodPositioning !== undefined) where.goodPositioning = filters.goodPositioning;
    if (filters.uniqueSkillActivated !== undefined)
      where.uniqueSkillActivated = filters.uniqueSkillActivated;

    return this.prisma.run.findMany({
      where,
      include: {
        characterTraining: {
          select: {
            characterName: true,
            identifierVersion: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id },
      include: {
        characterTraining: true,
      },
    });

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    if (run.characterTraining.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return run;
  }

  async update(id: string, userId: string, updateRunDto: UpdateRunDto) {
    const run = await this.prisma.run.findUnique({
      where: { id },
      include: {
        characterTraining: true,
      },
    });

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    if (run.characterTraining.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.run.update({
      where: { id },
      data: {
        ...updateRunDto,
        date: (updateRunDto as any).date ? new Date((updateRunDto as any).date) : undefined,
      },
      include: {
        characterTraining: {
          select: {
            characterName: true,
            identifierVersion: true,
          },
        },
      },
    });
  }

  async remove(id: string, userId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id },
      include: {
        characterTraining: true,
      },
    });

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    if (run.characterTraining.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.run.delete({
      where: { id },
    });

    return { message: 'Run deleted successfully' };
  }
}
