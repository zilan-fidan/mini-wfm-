export const WORK_ORDER_STATUS_CHANGED = 'workOrderStatusChanged';
export const WORK_ORDER_ASSIGNED = 'workOrderAssigned';
export const WORK_ORDER_OVERDUE = 'workOrderOverdue';

//  her olay benzersiz eventId taşır; tüketici aynı eventId'yi ikinci kez işlemez
interface EventEnvelope {
  eventId: string;
  eventVersion: 1;
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
  // Atama anındaki aktif üyeler; tüketici workforce-service'e geri sormaz
  members: { id: number; firstname: string; lastname: string }[];
  assignedById: number;
}

export interface WorkOrderOverdueEvent extends EventEnvelope {
  eventType: typeof WORK_ORDER_OVERDUE;
  workOrder: WorkOrderSnapshot & { priority: string; dueAt: string; status: string };
  // Ekipsiz iş emri de gecikebilir; o zaman team null, members boş
  team: { id: number; name: string } | null;
  members: { id: number; firstname: string; lastname: string }[];
}

// Kalıcı hata: mesaj kaç kez denenirse denensin işlenemez, kuyruğa geri konmaz
export class InvalidEventError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isPositiveInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

function parseEnvelope(data: unknown, eventType: string): Record<string, unknown> {
  if (!isObject(data)) {
    throw new InvalidEventError(`${eventType}: gövde nesne değil`);
  }
  if (typeof data.eventId !== 'string' || !UUID.test(data.eventId)) {
    throw new InvalidEventError(`${eventType}: geçersiz eventId`);
  }
  if (data.eventType !== eventType) {
    throw new InvalidEventError(`${eventType}: eventType uyuşmuyor (${String(data.eventType)})`);
  }
  if (!isObject(data.workOrder) || !isPositiveInt(data.workOrder.id)) {
    throw new InvalidEventError(`${eventType}: geçersiz workOrder`);
  }
  return data;
}

export function parseWorkOrderAssignedEvent(data: unknown): WorkOrderAssignedEvent {
  const event = parseEnvelope(data, WORK_ORDER_ASSIGNED);

  if (!isObject(event.team) || !isPositiveInt(event.team.id)) {
    throw new InvalidEventError(`${WORK_ORDER_ASSIGNED}: geçersiz team`);
  }
  if (
    !Array.isArray(event.members) ||
    !event.members.every((m) => isObject(m) && isPositiveInt(m.id))
  ) {
    throw new InvalidEventError(`${WORK_ORDER_ASSIGNED}: geçersiz members`);
  }
  return event as unknown as WorkOrderAssignedEvent;
}

export function parseWorkOrderOverdueEvent(data: unknown): WorkOrderOverdueEvent {
  const event = parseEnvelope(data, WORK_ORDER_OVERDUE);
  const workOrder = event.workOrder as Record<string, unknown>;

  if (typeof workOrder.dueAt !== 'string' || Number.isNaN(Date.parse(workOrder.dueAt))) {
    throw new InvalidEventError(`${WORK_ORDER_OVERDUE}: geçersiz workOrder.dueAt`);
  }
  if (event.team !== null && (!isObject(event.team) || !isPositiveInt(event.team.id))) {
    throw new InvalidEventError(`${WORK_ORDER_OVERDUE}: geçersiz team`);
  }
  if (
    !Array.isArray(event.members) ||
    !event.members.every((m) => isObject(m) && isPositiveInt(m.id))
  ) {
    throw new InvalidEventError(`${WORK_ORDER_OVERDUE}: geçersiz members`);
  }
  return event as unknown as WorkOrderOverdueEvent;
}

export function parseWorkOrderStatusChangedEvent(data: unknown): WorkOrderStatusChangedEvent {
  const event = parseEnvelope(data, WORK_ORDER_STATUS_CHANGED);

  if (typeof event.toStatus !== 'string') {
    throw new InvalidEventError(`${WORK_ORDER_STATUS_CHANGED}: geçersiz toStatus`);
  }
  return event as unknown as WorkOrderStatusChangedEvent;
}
