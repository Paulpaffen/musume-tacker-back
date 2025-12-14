import { IsString, IsNotEmpty, IsBoolean, IsOptional, MinLength } from 'class-validator';

export class CreateSkillDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsBoolean()
  @IsOptional()
  isRare?: boolean;
}
