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
  constructor(private readonly runService: RunService) { }

  @Post()
  create(@Request() req, @Body() createRunDto: CreateRunDto) {
    return this.runService.create(req.user.id, createRunDto);
  }

  @Get()
  findAll(
    @Request() req,
    @Query('characterTrainingId') characterTrainingId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('minPlace') minPlace?: string,
    @Query('maxPlace') maxPlace?: string,
    @Query('minScore') minScore?: string,
    @Query('maxScore') maxScore?: string,
    @Query('rareSkills') rareSkills?: string,
    @Query('normalSkills') normalSkills?: string,
    @Query('rushed') rushed?: string,
    @Query('goodPositioning') goodPositioning?: string,
    @Query('uniqueSkillActivated') uniqueSkillActivated?: string,
  ) {
    return this.runService.findAll(req.user.id, {
      characterTrainingId,
      startDate,
      endDate,
      minPlace: minPlace ? parseInt(minPlace) : undefined,
      maxPlace: maxPlace ? parseInt(maxPlace) : undefined,
      minScore: minScore ? parseInt(minScore) : undefined,
      maxScore: maxScore ? parseInt(maxScore) : undefined,
      rareSkills: rareSkills ? parseInt(rareSkills) : undefined,
      normalSkills: normalSkills ? parseInt(normalSkills) : undefined,
      rushed: rushed === 'true' ? true : rushed === 'false' ? false : undefined,
      goodPositioning: goodPositioning === 'true' ? true : goodPositioning === 'false' ? false : undefined,
      uniqueSkillActivated: uniqueSkillActivated === 'true' ? true : uniqueSkillActivated === 'false' ? false : undefined,
    });
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
