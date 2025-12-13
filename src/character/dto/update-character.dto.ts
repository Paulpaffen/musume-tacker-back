import { PartialType } from '@nestjs/mapped-types';
import { CreateCharacterDto, SkillDto } from './create-character.dto';

import {
  IsBoolean,
  IsOptional,
  IsNumber,
  IsString,
  IsInt,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export { SkillDto };

export class UpdateCharacterDto extends PartialType(CreateCharacterDto) {
  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  speed?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  stamina?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  power?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  guts?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  wit?: number;

  @IsOptional()
  @IsString()
  rank?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  @Type(() => Number)
  uniqueSkillLevel?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillDto)
  skills?: SkillDto[];
}
