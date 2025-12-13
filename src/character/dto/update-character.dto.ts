import { PartialType } from '@nestjs/mapped-types';
import { CreateCharacterDto } from './create-character.dto';

import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCharacterDto extends PartialType(CreateCharacterDto) {
    @IsBoolean()
    @IsOptional()
    isArchived?: boolean;

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
}
