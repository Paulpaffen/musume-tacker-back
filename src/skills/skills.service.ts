import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  async create(createSkillDto: CreateSkillDto) {
    // Check if skill already exists
    const existing = await this.prisma.skill.findUnique({
      where: { name: createSkillDto.name },
    });

    if (existing) {
      throw new ConflictException('Skill with this name already exists');
    }

    return this.prisma.skill.create({
      data: createSkillDto,
    });
  }

  async findAll(search?: string) {
    const where = search
      ? {
          name: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : {};

    return this.prisma.skill.findMany({
      where,
      orderBy: [{ timesUsed: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    return skill;
  }

  async update(id: string, updateSkillDto: UpdateSkillDto) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    return this.prisma.skill.update({
      where: { id },
      data: updateSkillDto,
    });
  }

  async remove(id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    return this.prisma.skill.delete({
      where: { id },
    });
  }

  // Fuzzy search for autocomplete
  async searchSimilar(query: string, limit: number = 10) {
    // Simple contains search for now
    const skills = await this.prisma.skill.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: [{ timesUsed: 'desc' }, { name: 'asc' }],
      take: limit,
    });

    return skills;
  }

  // Increment usage counter
  async incrementUsage(name: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { name },
    });

    if (skill) {
      return this.prisma.skill.update({
        where: { name },
        data: {
          timesUsed: {
            increment: 1,
          },
        },
      });
    }

    return null;
  }

  // Seed skills from existing character data
  async seedFromCharacters() {
    const characters = await this.prisma.characterTraining.findMany({
      where: {
        skills: {
          not: null,
        },
      },
      select: {
        skills: true,
      },
    });

    const skillsMap = new Map<string, { isRare: boolean; count: number }>();

    // Extract all unique skills
    for (const char of characters) {
      const skills = char.skills as Array<{ name: string; isRare: boolean }>;
      if (skills && Array.isArray(skills)) {
        for (const skill of skills) {
          const existing = skillsMap.get(skill.name);
          if (existing) {
            existing.count++;
            // If any occurrence is rare, mark as rare
            if (skill.isRare) {
              existing.isRare = true;
            }
          } else {
            skillsMap.set(skill.name, { isRare: skill.isRare, count: 1 });
          }
        }
      }
    }

    // Create skills in database
    const created = [];
    for (const [name, data] of skillsMap.entries()) {
      try {
        const skill = await this.prisma.skill.upsert({
          where: { name },
          update: {
            timesUsed: data.count,
            isRare: data.isRare,
          },
          create: {
            name,
            isRare: data.isRare,
            timesUsed: data.count,
          },
        });
        created.push(skill);
      } catch (error) {
        // Skip if error (e.g., duplicate)
        console.error(`Error creating skill ${name}:`, error);
      }
    }

    return {
      total: created.length,
      skills: created,
    };
  }
}
