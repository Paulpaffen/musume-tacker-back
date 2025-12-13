import { PartialType } from '@nestjs/mapped-types';
import { CreateCharacterDto } from './create-character.dto';

import { IsBoolean, IsOptional, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

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
}
