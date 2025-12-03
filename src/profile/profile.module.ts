import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProfileController],
})
export class ProfileModule {}
