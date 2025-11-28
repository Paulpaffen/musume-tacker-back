import { Module } from '@nestjs/common';
import { RunService } from './run.service';
import { RunController } from './run.controller';

@Module({
  controllers: [RunController],
  providers: [RunService],
})
export class RunModule {}
