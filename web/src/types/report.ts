import type { WorkOrderStatus } from './work-order';

export type TeamSummaryRow = {
  teamId: number;
  teamName: string;
  activeMemberCount: number;
  workOrders: Record<WorkOrderStatus, number> & { overdue: number };
  shiftHours: number;
};

export type TeamSummaryReport = {
  from: string;
  to: string;
  teams: TeamSummaryRow[];
};

export type TimesheetHours = {
  totalHours: number;
  nightHours: number;
  holidayHours: number;
  weekendHours: number;
  overtimeHours: number;
};

export type Timesheet = {
  workforceUserId: number;
  month: string;
  days: (TimesheetHours & { date: string })[];
  weeks: { weekStart: string; totalHours: number; overtimeHours: number; monthTotalHours: number; monthOvertimeHours: number }[];
  totals: TimesheetHours;
};
