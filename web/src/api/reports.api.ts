import { http } from './http';
import type { TeamSummaryReport, Timesheet } from '../types/report';

export async function getTeamSummary(from: string, to: string): Promise<TeamSummaryReport> {
  const { data } = await http.get<TeamSummaryReport>('/reports/team-summary', { params: { from, to } });
  return data;
}

export async function getTimesheet(workforceUserId: number | string, month: string): Promise<Timesheet> {
  const { data } = await http.get<Timesheet>(`/workforce-users/${workforceUserId}/timesheet`, {
    params: { month },
  });
  return data;
}
