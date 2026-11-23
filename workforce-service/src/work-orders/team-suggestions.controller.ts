import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { TeamSuggestionsService, TeamSuggestionsResponse } from './team-suggestions.service';

@Controller()
export class TeamSuggestionsController {
  constructor(private readonly teamSuggestionsService: TeamSuggestionsService) {}

  // api: GET /api/work-orders/:id/team-suggestions → 400 / 404 / 409 (OPEN değil)
  @MessagePattern('suggestTeamsForWorkOrder')
  suggestTeams(@Payload() id: number): Promise<TeamSuggestionsResponse> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new RpcException({ statusCode: 400, message: 'Geçersiz iş emri ID' });
    }
    return this.teamSuggestionsService.suggestTeams(id);
  }
}
