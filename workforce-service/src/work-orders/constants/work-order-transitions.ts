import { WorkOrderStatus } from '../enums/work-order-status.enum';

export type TransitionRule = {
  requiresReason?: boolean;
  adminOnly?: boolean;
  teamAction?: 'ASSIGN' | 'CLEAR';
};

export const WORK_ORDER_TRANSITION_RULES: Record<
  WorkOrderStatus,
  Partial<Record<WorkOrderStatus, TransitionRule>>> = {
  [WorkOrderStatus.OPEN]: {
    [WorkOrderStatus.ASSIGNED]: {teamAction: 'ASSIGN',},
    [WorkOrderStatus.CANCELLED]: { requiresReason: true,},
  },

  [WorkOrderStatus.ASSIGNED]: {
    [WorkOrderStatus.IN_PROGRESS]: {},
    [WorkOrderStatus.OPEN]: {teamAction: 'CLEAR',},
    [WorkOrderStatus.CANCELLED]: {requiresReason: true,},
  },

  [WorkOrderStatus.IN_PROGRESS]: {
    [WorkOrderStatus.COMPLETED]: {},
    [WorkOrderStatus.CANCELLED]: { requiresReason: true,adminOnly: true, },
  },

  [WorkOrderStatus.COMPLETED]: {},

  [WorkOrderStatus.CANCELLED]: {},
};

// Önceki testlerimizde kullanılan geçiş listesi
export const WORK_ORDER_TRANSITIONS = Object.fromEntries(
  Object.entries(WORK_ORDER_TRANSITION_RULES).map(
    ([status, transitions]) => [
      status,
      Object.keys(transitions),
    ],
  ),
) as Record<WorkOrderStatus, WorkOrderStatus[]>;

// Hata mesajlarında kullanılacak Türkçe karşılıklar
export const WORK_ORDER_STATUS_LABELS: Record<
  WorkOrderStatus,
  string
> = {
  [WorkOrderStatus.OPEN]: 'Açık',
  [WorkOrderStatus.ASSIGNED]: 'Atandı',
  [WorkOrderStatus.IN_PROGRESS]: 'Devam Ediyor',
  [WorkOrderStatus.COMPLETED]: 'Tamamlandı',
  [WorkOrderStatus.CANCELLED]: 'İptal Edildi',
};
