export type NotificationType = 'WORK_ORDER_ASSIGNED' | 'WORK_ORDER_OVERDUE';

export type AppNotification = {
  id: number;
  eventId: string;
  type: NotificationType;
  workforceUserId: number;
  title: string;
  body: string;
  createdAt: string;
};
