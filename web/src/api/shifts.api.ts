import { http } from './http';
import type {
  ListShiftsParams,
  RotationPlanPayload,
  RotationPlanResponse,
  Shift,
  ShiftPayload,
  TeamShiftPayload,
} from '../types/shift';

export async function listShifts(params: ListShiftsParams): Promise<Shift[]> {
  const { data } = await http.get<Shift[]>('/shifts', { params });
  return data;
}

export async function createShift(payload: ShiftPayload): Promise<Shift> {
  const { data } = await http.post<Shift>('/shifts', payload);
  return data;
}

export async function updateShift(id: number, payload: Partial<ShiftPayload>): Promise<Shift> {
  const { data } = await http.patch<Shift>(`/shifts/${id}`, payload);
  return data;
}

export async function deleteShift(id: number): Promise<void> {
  await http.delete(`/shifts/${id}`);
}

// Ekibin aktif üyelerine aynı vardiyayı toplu atar
export async function createTeamShifts(teamId: number, payload: TeamShiftPayload): Promise<Shift[]> {
  const { data } = await http.post<Shift[]>(`/teams/${teamId}/shifts`, payload);
  return data;
}

// apply=false önizleme, apply=true kaydeder
export async function createRotationPlan(
  teamId: number,
  payload: RotationPlanPayload,
): Promise<RotationPlanResponse> {
  const { data } = await http.post<RotationPlanResponse>(`/teams/${teamId}/rotation-plan`, payload);
  return data;
}
