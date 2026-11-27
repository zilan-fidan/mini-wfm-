import { http } from './http';
import type { PaginatedResponse } from '../types/pagination';
import type {
  ChangeStatusPayload,
  CreateWorkOrderPayload,
  ListWorkOrdersParams,
  TeamSuggestions,
  UpdateWorkOrderPayload,
  WorkOrder,
  WorkOrderDetail,
  WorkOrderHistoryItem,
} from '../types/work-order';

export async function listWorkOrders(params: ListWorkOrdersParams): Promise<PaginatedResponse<WorkOrder>> {
  const { data } = await http.get<PaginatedResponse<WorkOrder>>('/work-orders', {
    params,
    paramsSerializer: { indexes: null }, // status=OPEN&status=ASSIGNED
  });
  return data;
}

export async function getWorkOrder(id: number | string): Promise<WorkOrderDetail> {
  const { data } = await http.get<WorkOrderDetail>(`/work-orders/${id}`);
  return data;
}

export async function createWorkOrder(payload: CreateWorkOrderPayload): Promise<WorkOrderDetail> {
  const { data } = await http.post<WorkOrderDetail>('/work-orders', payload);
  return data;
}

export async function updateWorkOrder(id: number, payload: UpdateWorkOrderPayload): Promise<WorkOrderDetail> {
  const { data } = await http.patch<WorkOrderDetail>(`/work-orders/${id}`, payload);
  return data;
}

export async function changeWorkOrderStatus(id: number, payload: ChangeStatusPayload): Promise<WorkOrderDetail> {
  const { data } = await http.patch<WorkOrderDetail>(`/work-orders/${id}/status`, payload);
  return data;
}

export async function getWorkOrderHistory(id: number | string): Promise<WorkOrderHistoryItem[]> {
  const { data } = await http.get<WorkOrderHistoryItem[]>(`/work-orders/${id}/history`);
  return data;
}

export async function getTeamSuggestions(id: number | string): Promise<TeamSuggestions> {
  const { data } = await http.get<TeamSuggestions>(`/work-orders/${id}/team-suggestions`);
  return data;
}
