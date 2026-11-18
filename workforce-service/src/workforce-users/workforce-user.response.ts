import { WorkforceUser } from './entities/workforce-user.entity';

export type TeamSummary = { id: number; name: string };

export type WorkforceUserResponse = Omit<WorkforceUser, 'team'> & {
  team: TeamSummary | null;
};

// Personel cevaplarında ekip her zaman { id, name } ya da null olarak döner
export function toWorkforceUserResponse(workforceUser: WorkforceUser): WorkforceUserResponse {
  const { team, ...rest } = workforceUser;
  return {
    ...rest,
    team: team ? { id: team.id, name: team.name } : null,
  };
}
