import { IsString, IsNotEmpty, IsOptional, MinLength, IsInt, Min, Max, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class SkillDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsBoolean()
  isRare: boolean;
}

export class CreateCharacterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  characterName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  identifierVersion: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  speed?: number;

  @IsOptional()
  stamina?: number;

  @IsOptional()
  power?: number;

  @IsOptional()
  guts?: number;

  @IsOptional()
  wit?: number;

  @IsOptional()
  rank?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  uniqueSkillLevel?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillDto)
  skills?: SkillDto[];

  @IsOptional()
  createdAt?: string;
}
