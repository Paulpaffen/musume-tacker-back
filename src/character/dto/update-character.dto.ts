import { PartialType } from '@nestjs/mapped-types';
import { CreateCharacterDto } from './create-character.dto';

import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCharacterDto extends PartialType(CreateCharacterDto) {
    @IsBoolean()
    @IsOptional()
    isArchived?: boolean;
}
