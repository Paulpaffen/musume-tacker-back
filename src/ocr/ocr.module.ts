import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SkillsModule } from '../skills/skills.module';

@Module({
  imports: [PrismaModule, SkillsModule],
  controllers: [OcrController],
  providers: [OcrService],
})
export class OcrModule {}
