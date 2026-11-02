import { http } from './http';
import type { PaginatedResponse } from '../types/pagination';
import type {CreateWorkforceUserPayload, ListWorkforceUsersParams,UpdateWorkforceUserPayload,WorkforceUser,} from '../types/workforce-user';

export async function listWorkforceUsers(params?: ListWorkforceUsersParams,): 
Promise<PaginatedResponse<WorkforceUser>> {const { data } = await http.get<PaginatedResponse<WorkforceUser>>('/workforce-users', { params },);
  return data;
}

export async function getWorkforceUser(id: number | string,): 
Promise<WorkforceUser> {const { data } = await http.get<WorkforceUser>(`/workforce-users/${id}`);
  return data;
}

export async function createWorkforceUser(payload: CreateWorkforceUserPayload,):
Promise<WorkforceUser> {const { data } = await http.post<WorkforceUser>('/workforce-users', payload);
  return data;
}

export async function updateWorkforceUser(id: number | string,payload: UpdateWorkforceUserPayload,): 
Promise<WorkforceUser> {const { data } = await http.patch<WorkforceUser>( `/workforce-users/${id}`,payload, );
  return data;
}

export async function deleteWorkforceUser(id: number | string): Promise<void> {
  await http.delete(`/workforce-users/${id}`);
}
