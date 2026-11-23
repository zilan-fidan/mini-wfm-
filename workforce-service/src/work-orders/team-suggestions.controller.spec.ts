import { RpcException } from '@nestjs/microservices';
import { TeamSuggestionsController } from './team-suggestions.controller';
import { TeamSuggestionsService } from './team-suggestions.service';

describe('TeamSuggestionsController', () => {
  const suggestTeams = jest.fn();
  const controller = new TeamSuggestionsController({ suggestTeams } as unknown as TeamSuggestionsService);

  beforeEach(() => suggestTeams.mockReset());

  it('geçerli ID service\'e iletilir', async () => {
    suggestTeams.mockResolvedValue({ suggestions: [] });
    await controller.suggestTeams(5);
    expect(suggestTeams).toHaveBeenCalledWith(5);
  });

  it.each([0, -1, 1.5, '5' as unknown as number])('400: %p', (id) => {
    expect(() => controller.suggestTeams(id)).toThrow(RpcException);
    expect(suggestTeams).not.toHaveBeenCalled();
  });
});
