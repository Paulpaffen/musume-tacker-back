import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  getDashboardStats(@Request() req) {
    return this.statsService.getDashboardStats(req.user.id);
  }

  @Get('character/:id')
  getCharacterStats(@Param('id') id: string, @Request() req) {
    return this.statsService.getCharacterStats(id, req.user.id);
  }

  @Post('compare')
  compareCharacters(@Body() body: { characterIds: string[] }, @Request() req) {
    return this.statsService.compareCharacters(body.characterIds, req.user.id);
  }

  @Get('team-recommendations')
  getTeamRecommendations(@Request() req) {
    return this.statsService.getTeamRecommendations(req.user.id);
  }
}
