import { Module } from '@nestjs/common';
import { CharacterService } from './character.service';
import { CharacterController } from './character.controller';
import { SkillsModule } from '../skills/skills.module';

@Module({
  imports: [SkillsModule],
  controllers: [CharacterController],
  providers: [CharacterService],
})
export class CharacterModule {}
