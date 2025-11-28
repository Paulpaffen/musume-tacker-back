import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

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
}
