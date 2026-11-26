import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TeamSummaryService } from './team-summary.service';
import type { TeamSummaryQuery, TeamSummaryReport } from './team-summary.service';

@Controller()
export class ReportsController {
  constructor(private readonly teamSummaryService: TeamSummaryService) {}

  // api: GET /api/reports/team-summary?from=&to=
  @MessagePattern('getTeamSummaryReport')
  getTeamSummary(@Payload() query: TeamSummaryQuery): Promise<TeamSummaryReport> {
    return this.teamSummaryService.getTeamSummary(query);
  }
}
