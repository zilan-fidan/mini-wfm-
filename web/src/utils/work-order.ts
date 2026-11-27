import type { Role } from '../types/auth';
import type { WorkOrderPriority, WorkOrderStatus } from '../types/work-order';

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  OPEN: 'Açık',
  ASSIGNED: 'Atandı',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal Edildi',
};

export const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  OPEN: 'blue',
  ASSIGNED: 'geekblue',
  IN_PROGRESS: 'gold',
  COMPLETED: 'green',
  CANCELLED: 'default',
};

export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  URGENT: 'Acil',
};

export const PRIORITY_COLORS: Record<WorkOrderPriority, string> = {
  LOW: 'default',
  MEDIUM: 'cyan',
  HIGH: 'orange',
  URGENT: 'red',
};

export const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as WorkOrderStatus[]).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

export const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABELS) as WorkOrderPriority[]).map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}));

type Transition = {
  to: WorkOrderStatus;
  action: string; // buton metni
  requiresReason?: boolean;
  requiresTeam?: boolean;
  adminOnly?: boolean;
};

// workforce-service/src/work-orders/constants/work-order-transitions.ts ile aynı tutulmalı.
// Son karar backend'dedir; burada yalnızca uygun butonları göstermek için kullanılır.
const TRANSITIONS: Record<WorkOrderStatus, Transition[]> = {
  OPEN: [
    { to: 'ASSIGNED', action: 'Ekibe Ata', requiresTeam: true },
    { to: 'CANCELLED', action: 'İptal Et', requiresReason: true },
  ],
  ASSIGNED: [
    { to: 'IN_PROGRESS', action: 'İşe Başla' },
    { to: 'OPEN', action: 'Atamayı Kaldır' },
    { to: 'CANCELLED', action: 'İptal Et', requiresReason: true },
  ],
  IN_PROGRESS: [
    { to: 'COMPLETED', action: 'Tamamla' },
    { to: 'CANCELLED', action: 'İptal Et', requiresReason: true, adminOnly: true },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

export const availableTransitions = (status: WorkOrderStatus, role: Role) =>
  TRANSITIONS[status].filter((t) => !t.adminOnly || role === 'ADMIN');

export type { Transition };
