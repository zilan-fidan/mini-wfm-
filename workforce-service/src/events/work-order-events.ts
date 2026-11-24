export const WORK_ORDER_STATUS_CHANGED = 'workOrderStatusChanged';
export const WORK_ORDER_ASSIGNED = 'workOrderAssigned';

// her olay benzersiz eventId taşır; tüketici aynı eventId'yi ikinci kez işlemez.
// Olay, tüketicinin işini yapması için gereken bilgiyi kendisi taşır; tüketici geri sormaz.
interface EventEnvelope {
  eventId: string;
  eventVersion: 1;
  // Değişikliğin yapıldığı an (yayın anı değil)
  occurredAt: string;
  // Olayı tetikleyen HTTP isteğinin correlation id'si
  correlationId: string | null;
}

export interface WorkOrderSnapshot {
  id: number;
  code: string;
  title: string;
  version: number;
}

export interface WorkOrderStatusChangedEvent extends EventEnvelope {
  eventType: typeof WORK_ORDER_STATUS_CHANGED;
  workOrder: WorkOrderSnapshot;
  fromStatus: string;
  toStatus: string;
  teamId: number | null;
  reason: string | null;
  changedById: number;
}

export interface WorkOrderAssignedEvent extends EventEnvelope {
  eventType: typeof WORK_ORDER_ASSIGNED;
  workOrder: WorkOrderSnapshot & { priority: string; dueAt: string };
  team: { id: number; name: string };
  // Atama anındaki aktif üyeler (aynı transaction içinde okunur)
  members: { id: number; firstname: string; lastname: string }[];
  assignedById: number;
}

export type WorkOrderEvent = WorkOrderStatusChangedEvent | WorkOrderAssignedEvent;

// Servis transaction içinde olayın içeriğini hazırlar; kimlik ve correlation id'yi yayıncı ekler
type Draft<T> = T extends unknown ? Omit<T, 'eventId' | 'eventVersion' | 'correlationId'> : never;
export type WorkOrderEventDraft = Draft<WorkOrderEvent>;
