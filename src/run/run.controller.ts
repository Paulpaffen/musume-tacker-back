import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { RunService } from './run.service';
import { CreateRunDto } from './dto/create-run.dto';
import { UpdateRunDto } from './dto/update-run.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('runs')
@UseGuards(JwtAuthGuard)
export class RunController {
  constructor(private readonly runService: RunService) {}

  @Post()
  create(@Request() req, @Body() createRunDto: CreateRunDto) {
    return this.runService.create(req.user.id, createRunDto);
  }

  @Get()
  findAll(@Request() req, @Query('characterTrainingId') characterTrainingId?: string) {
    return this.runService.findAll(req.user.id, characterTrainingId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.runService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Request() req, @Body() updateRunDto: UpdateRunDto) {
    return this.runService.update(id, req.user.id, updateRunDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.runService.remove(id, req.user.id);
  }
}
