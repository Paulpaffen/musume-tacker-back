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

  async findAll(userId: string, characterTrainingId?: string) {
    // Build where clause
    const where: any = {};

    if (characterTrainingId) {
      // Verify character belongs to user
      const character = await this.prisma.characterTraining.findUnique({
        where: { id: characterTrainingId },
      });

      if (!character) {
        throw new NotFoundException('Character not found');
      }

      if (character.userId !== userId) {
        throw new ForbiddenException('Access denied');
      }

      where.characterTrainingId = characterTrainingId;
    } else {
      // Get all runs for all user's characters
      const userCharacters = await this.prisma.characterTraining.findMany({
        where: { userId },
        select: { id: true },
      });

      where.characterTrainingId = {
        in: userCharacters.map((c) => c.id),
      };
    }

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
