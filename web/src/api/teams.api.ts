import { http } from './http';
import type { PaginatedResponse } from '../types/pagination';
import type {CreateTeamPayload,ListTeamsParams,Team,TeamDetail,UpdateTeamPayload,} from '../types/team';
import type { WorkforceUser } from '../types/workforce-user';

export async function listTeams(
  params?: ListTeamsParams,
): Promise<PaginatedResponse<Team>> {
  const { data } = await http.get<PaginatedResponse<Team>>('/teams', {params,
  });
  return data;
}

export async function getTeam(id: number | string): Promise<TeamDetail> {
  const { data } = await http.get<TeamDetail>(`/teams/${id}`);
  return data;
}

export async function createTeam(payload: CreateTeamPayload): Promise<Team> {
  const { data } = await http.post<Team>('/teams', payload);
  return data;
}

export async function updateTeam(
  id: number | string,
  payload: UpdateTeamPayload,
): Promise<Team> {
  const { data } = await http.patch<Team>(`/teams/${id}`, payload);
  return data;
}

export async function deleteTeam(id: number | string): Promise<void> {
  await http.delete(`/teams/${id}`);
}

export async function addTeamMember(
  teamId: number | string,
  workforceUserId: number,):
Promise<WorkforceUser> {const { data } = await http.post<WorkforceUser>(`/teams/${teamId}/members`, {workforceUserId,});return data;}

export async function removeTeamMember(teamId: number | string,workforceUserId: number,): 
Promise<void> {await http.delete(`/teams/${teamId}/members/${workforceUserId}`);}