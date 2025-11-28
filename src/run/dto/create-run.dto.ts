import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsBoolean,
  IsEnum,
  IsDateString,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { TrackType } from '@prisma/client';

export class CreateRunDto {
  @IsString()
  @IsNotEmpty()
  characterTrainingId: string;

  @IsEnum(TrackType)
  trackType: TrackType;

  @IsInt()
  @Min(1)
  @Max(18)
  finalPlace: number;

  @IsInt()
  @Min(0)
  rareSkillsCount: number;

  @IsInt()
  @Min(0)
  normalSkillsCount: number;

  @IsBoolean()
  uniqueSkillActivated: boolean;

  @IsBoolean()
  goodPositioning: boolean;

  @IsBoolean()
  rushed: boolean;

  @IsInt()
  @Min(0)
  score: number;

  @IsDateString()
  @IsOptional()
  date?: string;
}
