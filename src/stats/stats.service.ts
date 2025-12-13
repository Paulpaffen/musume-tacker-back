import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackType } from '@prisma/client';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) { }

  async getDashboardStats(userId: string) {
    // Get all user's characters
    const characters = await this.prisma.characterTraining.findMany({
      where: {
        userId,
        isArchived: false,
      } as any,
      select: { id: true },
    });

    const characterIds = characters.map((c) => c.id);

    if (characterIds.length === 0) {
      return this.getEmptyStats();
    }

    // Get all runs
    const runs = await this.prisma.run.findMany({
      where: {
        characterTrainingId: { in: characterIds },
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

    if (runs.length === 0) {
      return this.getEmptyStats();
    }

    // Calculate general stats
    const totalRuns = runs.length;
    const averageScore = runs.reduce((sum, run) => sum + run.score, 0) / totalRuns;
    const averageFinalPlace = runs.reduce((sum, run) => sum + run.finalPlace, 0) / totalRuns;
    const rushedRate = (runs.filter((r) => r.rushed).length / totalRuns) * 100;
    const uniqueSkillRate = (runs.filter((r) => r.uniqueSkillActivated).length / totalRuns) * 100;
    const goodPositioningRate = (runs.filter((r) => r.goodPositioning).length / totalRuns) * 100;

    const averageRareSkills = runs.reduce((sum, run) => sum + run.rareSkillsCount, 0) / totalRuns;
    const averageNormalSkills =
      runs.reduce((sum, run) => sum + run.normalSkillsCount, 0) / totalRuns;

    // Stats by track
    const statsByTrack = await this.getStatsByTrack(characterIds);

    // Stats by character
    const statsByCharacter = await this.getStatsByCharacter(characterIds);

    // Recent runs
    const recentRuns = runs.slice(0, 10);

    // Best runs
    const bestRuns = [...runs].sort((a, b) => b.score - a.score).slice(0, 10);

    return {
      overview: {
        totalRuns,
        averageScore: Math.round(averageScore),
        averageFinalPlace: parseFloat(averageFinalPlace.toFixed(2)),
        rushedRate: parseFloat(rushedRate.toFixed(2)),
        uniqueSkillRate: parseFloat(uniqueSkillRate.toFixed(2)),
        goodPositioningRate: parseFloat(goodPositioningRate.toFixed(2)),
        averageRareSkills: parseFloat(averageRareSkills.toFixed(2)),
        averageNormalSkills: parseFloat(averageNormalSkills.toFixed(2)),
      },
      byTrack: statsByTrack,
      byCharacter: statsByCharacter,
      recentRuns,
      bestRuns,
    };
  }

  private async getStatsByTrack(characterIds: string[]) {
    const tracks = Object.values(TrackType);
    const statsByTrack = [];

    for (const track of tracks) {
      const runs = await this.prisma.run.findMany({
        where: {
          characterTrainingId: { in: characterIds },
          trackType: track,
        },
      });

      if (runs.length > 0) {
        const avgScore = runs.reduce((sum, run) => sum + run.score, 0) / runs.length;
        const avgPlace = runs.reduce((sum, run) => sum + run.finalPlace, 0) / runs.length;
        const rushedRate = (runs.filter((r) => r.rushed).length / runs.length) * 100;

        statsByTrack.push({
          trackType: track,
          totalRuns: runs.length,
          averageScore: Math.round(avgScore),
          averageFinalPlace: parseFloat(avgPlace.toFixed(2)),
          rushedRate: parseFloat(rushedRate.toFixed(2)),
          bestScore: Math.max(...runs.map((r) => r.score)),
        });
      }
    }

    return statsByTrack;
  }

  private async getStatsByCharacter(characterIds: string[]) {
    const characters = await this.prisma.characterTraining.findMany({
      where: {
        id: { in: characterIds },
        isArchived: false,
      } as any,
      include: {
        runs: true,
      },
    });

    return characters
      .filter((char) => char.runs.length > 0)
      .map((char) => {
        const runs = char.runs;
        const avgScore = runs.reduce((sum, run) => sum + run.score, 0) / runs.length;
        const avgPlace = runs.reduce((sum, run) => sum + run.finalPlace, 0) / runs.length;
        const rushedRate = (runs.filter((r) => r.rushed).length / runs.length) * 100;

        return {
          characterId: char.id,
          characterName: char.characterName,
          identifierVersion: char.identifierVersion,
          totalRuns: runs.length,
          averageScore: Math.round(avgScore),
          averageFinalPlace: parseFloat(avgPlace.toFixed(2)),
          rushedRate: parseFloat(rushedRate.toFixed(2)),
          bestScore: Math.max(...runs.map((r) => r.score)),
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore);
  }

  private getEmptyStats() {
    return {
      overview: {
        totalRuns: 0,
        averageScore: 0,
        averageFinalPlace: 0,
        rushedRate: 0,
        uniqueSkillRate: 0,
        goodPositioningRate: 0,
        averageRareSkills: 0,
        averageNormalSkills: 0,
      },
      byTrack: [],
      byCharacter: [],
      recentRuns: [],
      bestRuns: [],
    };
  }

  async getCharacterStats(characterId: string, userId: string) {
    // Verify character belongs to user
    const character = await this.prisma.characterTraining.findUnique({
      where: { id: characterId },
    });

    if (!character || character.userId !== userId) {
      throw new Error('Character not found or access denied');
    }

    const runs = await this.prisma.run.findMany({
      where: { characterTrainingId: characterId },
      orderBy: { date: 'desc' },
    });

    if (runs.length === 0) {
      return {
        totalRuns: 0,
        averageScore: 0,
        averageFinalPlace: 0,
        bestScore: 0,
        worstScore: 0,
        byTrack: [],
        uniqueSkillRate: 0,
        rushedRate: 0,
        goodPositioningRate: 0,
        averageRareSkills: 0,
        averageNormalSkills: 0,
      };
    }

    const totalRuns = runs.length;
    const averageScore = runs.reduce((sum, run) => sum + run.score, 0) / totalRuns;
    const averageFinalPlace = runs.reduce((sum, run) => sum + run.finalPlace, 0) / totalRuns;
    const rushedRate = runs.filter((r) => r.rushed).length / totalRuns;
    const uniqueSkillRate = runs.filter((r) => r.uniqueSkillActivated).length / totalRuns;
    const goodPositioningRate = runs.filter((r) => r.goodPositioning).length / totalRuns;

    // Stats by track for this character
    const byTrack = Object.values(TrackType)
      .map((track) => {
        const trackRuns = runs.filter((r) => r.trackType === track);
        if (trackRuns.length === 0) return null;

        const avgScore = trackRuns.reduce((sum, r) => sum + r.score, 0) / trackRuns.length;
        const avgPlace = trackRuns.reduce((sum, r) => sum + r.finalPlace, 0) / trackRuns.length;

        return {
          trackType: track,
          count: trackRuns.length,
          averageScore: Math.round(avgScore),
          averagePlace: parseFloat(avgPlace.toFixed(2)),
        };
      })
      .filter(Boolean);

    return {
      totalRuns,
      averageScore: Math.round(averageScore),
      averageFinalPlace: parseFloat(averageFinalPlace.toFixed(2)),
      bestScore: Math.max(...runs.map((r) => r.score)),
      worstScore: Math.min(...runs.map((r) => r.score)),
      byTrack,
      uniqueSkillRate,
      rushedRate,
      goodPositioningRate,
      averageRareSkills: parseFloat(
        (runs.reduce((sum, run) => sum + run.rareSkillsCount, 0) / totalRuns).toFixed(2),
      ),
      averageNormalSkills: parseFloat(
        (runs.reduce((sum, run) => sum + run.normalSkillsCount, 0) / totalRuns).toFixed(2),
      ),
    };
  }

  async compareCharacters(characterIds: string[], userId: string) {
    // Verify all characters belong to user
    const characters = await this.prisma.characterTraining.findMany({
      where: {
        id: { in: characterIds },
        userId,
      },
      select: { id: true, characterName: true, identifierVersion: true },
    });

    if (characters.length !== characterIds.length) {
      throw new Error('Some characters not found or access denied');
    }

    const comparisonResults = await Promise.all(
      characters.map(async (char) => {
        const stats = await this.getCharacterStats(char.id, userId);
        return {
          characterId: char.id,
          characterName: char.characterName,
          identifierVersion: char.identifierVersion,
          ...stats,
        };
      }),
    );

    return comparisonResults;
  }

  async getTeamRecommendations(userId: string) {
    const trackTypes = ['TURF_SHORT', 'TURF_MILE', 'TURF_MEDIUM', 'TURF_LONG', 'DIRT'];
    const recommendations: any = {};

    for (const trackType of trackTypes) {
      // Get all user's characters
      const characters = await this.prisma.characterTraining.findMany({
        where: { userId },
        include: {
          runs: {
            where: { trackType: trackType as any },
          },
        },
      });

      // Calculate stats for each character on this track
      const characterStats = characters
        .map((char) => {
          const trackRuns = char.runs;
          if (trackRuns.length === 0) return null;

          const avgScore = trackRuns.reduce((sum, run) => sum + run.score, 0) / trackRuns.length;

          // Count how many times this character ran on each track
          const allRuns = char.runs;
          const trackCounts: Record<string, number> = {};
          allRuns.forEach((run) => {
            trackCounts[run.trackType] = (trackCounts[run.trackType] || 0) + 1;
          });

          // Find the most played track
          let mostPlayedTrack = trackType;
          let maxCount = trackCounts[trackType] || 0;
          Object.entries(trackCounts).forEach(([track, count]) => {
            if (count > maxCount) {
              maxCount = count;
              mostPlayedTrack = track;
            }
          });

          return {
            id: char.id,
            characterName: char.characterName,
            identifierVersion: char.identifierVersion,
            averageScore: Math.round(avgScore),
            totalRuns: trackRuns.length,
            mostPlayedTrack,
            isMostPlayedTrack: mostPlayedTrack === trackType,
          };
        })
        .filter((stat) => stat !== null && stat.isMostPlayedTrack) // Only characters where this is their most played track
        .sort((a, b) => b!.averageScore - a!.averageScore) // Sort by average score descending
        .slice(0, 3); // Top 3

      recommendations[trackType] = characterStats;
    }

    return recommendations;
  }
}
