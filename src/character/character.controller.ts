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
import { CharacterService } from './character.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('characters')
@UseGuards(JwtAuthGuard)
export class CharacterController {
  constructor(private readonly characterService: CharacterService) { }

  @Post()
  create(@Request() req, @Body() createCharacterDto: CreateCharacterDto) {
    return this.characterService.create(req.user.id, createCharacterDto);
  }

  @Get()
  findAll(
    @Request() req,
    @Query('name') name?: string,
    @Query('minRuns') minRuns?: string,
    @Query('maxRuns') maxRuns?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.characterService.findAll(req.user.id, {
      name,
      minRuns: minRuns ? parseInt(minRuns) : undefined,
      maxRuns: maxRuns ? parseInt(maxRuns) : undefined,
      includeArchived: includeArchived === 'true',
    });
  }

  @Get('candidates')
  async getCandidates(@Request() req) {
    // Accept detectedName from query string for flexibility
    const detectedName = req.query.name;
    if (!detectedName) return [];
    return this.characterService.findCandidates(req.user.id, detectedName);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.characterService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Request() req, @Body() updateCharacterDto: UpdateCharacterDto) {
    return this.characterService.update(id, req.user.id, updateCharacterDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.characterService.remove(id, req.user.id);
  }
}
