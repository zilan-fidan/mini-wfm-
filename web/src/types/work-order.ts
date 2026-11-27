import type { TeamSummary } from './workforce-user';

export type WorkOrderStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// Liste satırı: ekip özeti ve gecikme bilgisiyle gelir
export type WorkOrder = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
  version: number; // iyimser kilit: güncellemede geri gönderilir
  team: TeamSummary | null;
  isOverdue: boolean;
};

// Detay: ekip yerine teamId gelir
export type WorkOrderDetail = Omit<WorkOrder, 'team' | 'isOverdue'> & {
  teamId: number | null;
  overdueNotifiedAt: string | null;
  createdById: number;
};

export type ListWorkOrdersParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: WorkOrderStatus[];
  priority?: WorkOrderPriority;
  teamId?: number;
  overdue?: boolean;
  sortBy?: 'createdAt' | 'dueAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
};

export type CreateWorkOrderPayload = {
  title: string;
  description?: string;
  priority?: WorkOrderPriority;
  teamId?: number;
  dueAt: string;
};

export type UpdateWorkOrderPayload = {
  version: number;
  title?: string;
  description?: string;
  priority?: WorkOrderPriority;
  dueAt?: string;
};

export type ChangeStatusPayload = {
  version: number;
  status: WorkOrderStatus;
  teamId?: number;
  reason?: string;
};

export type WorkOrderHistoryItem = {
  id: number;
  workOrderId: number;
  fromStatus: WorkOrderStatus | null;
  toStatus: WorkOrderStatus;
  teamId: number | null;
  reason: string | null;
  changedById: number;
  changedByUsername: string;
  changedAt: string;
};

export type ScoreCriterion = 'capacityHours' | 'openWorkOrders' | 'overdueWorkOrders';

export type TeamSuggestions = {
  workOrderId: number;
  priority: WorkOrderPriority;
  window: { from: string; to: string };
  suggestions: {
    teamId: number;
    teamName: string;
    totalScore: number;
    breakdown: { criterion: ScoreCriterion; value: number; weight: number; points: number }[];
  }[];
  excluded: { teamId: number; teamName: string; reason: string }[];
};
