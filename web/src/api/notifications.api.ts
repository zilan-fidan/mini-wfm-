import { http } from './http';
import type { AppNotification } from '../types/notification';

// En yeni 100 bildirim, yeniden eskiye
export async function listNotifications(workforceUserId: number): Promise<AppNotification[]> {
  const { data } = await http.get<AppNotification[]>('/notifications', { params: { workforceUserId } });
  return data;
}
