import type { TeamSummary } from './workforce-user';

export type Shift = {
  id: number;
  workforceUserId: number;
  workforceUser: {
    id: number;
    firstname: string;
    lastname: string;
    team: TeamSummary | null;
  };
  startAt: string;
  endAt: string;
  note: string | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
};

export type ListShiftsParams = {
  from: string; // ISO 8601, saat dilimi içerir
  to: string; // hariç; aralık en fazla 31 gün
  workforceUserId?: number;
  teamId?: number;
};

export type ShiftPayload = {
  workforceUserId: number;
  startAt: string;
  endAt: string;
  note?: string | null;
};

export type TeamShiftPayload = Omit<ShiftPayload, 'workforceUserId'>;

export type RotationSlot = {
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm veya 24:00
  required: number;
};

export type RotationPlanPayload = {
  startDate: string; // YYYY-MM-DD
  days: number;
  slots: RotationSlot[];
  apply?: boolean;
};

type PersonRef = {
  workforceUserId: number;
  registrationNumber: string;
  firstname: string;
  lastname: string;
};

export type RotationPlanResponse = {
  teamId: number;
  startDate: string;
  days: number;
  applied: boolean;
  assignments: (PersonRef & { shiftId?: number; date: string; slotName: string; startAt: string; endAt: string })[];
  workloads: (PersonRef & { shiftCount: number; totalHours: number })[];
  unfilled: { date: string; slotName: string; startAt: string; endAt: string; required: number; assigned: number; missing: number }[];
  fairnessGapHours: number;
};
