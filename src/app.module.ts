import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CharacterModule } from './character/character.module';
import { RunModule } from './run/run.module';
import { StatsModule } from './stats/stats.module';
import { OcrModule } from './ocr/ocr.module';
import { FriendsModule } from './friends/friends.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    CharacterModule,
    RunModule,
    StatsModule,
    OcrModule,
    FriendsModule,
    ProfileModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
