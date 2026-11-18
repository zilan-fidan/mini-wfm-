import { HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { WorkOrderPriority } from '../enums/work-order-priority.enum';
import { WorkOrderStatus } from '../enums/work-order-status.enum';

// Liste sorgusunda iş emri tablosunun takma adı; aşağıdaki SQL parçaları bu ada göre yazıldı
export const WORK_ORDER_ALIAS = 'wo';

// Kapanmış iş emirleri hiçbir zaman "süresi geçmiş" sayılmaz
export const CLOSED_WORK_ORDER_STATUSES = [
  WorkOrderStatus.COMPLETED,
  WorkOrderStatus.CANCELLED,
];

// Önem sırası: büyük sayı = daha önemli. Alfabetik sıralama HIGH, LOW, MEDIUM, URGENT verirdi
export const PRIORITY_RANK: Record<WorkOrderPriority, number> = {
  [WorkOrderPriority.URGENT]: 4,
  [WorkOrderPriority.HIGH]: 3,
  [WorkOrderPriority.MEDIUM]: 2,
  [WorkOrderPriority.LOW]: 1,
};

// Değerler kullanıcıdan değil, yukarıdaki sabit tablodan gelir
export const PRIORITY_RANK_SQL =
  `CASE "${WORK_ORDER_ALIAS}"."priority" ` +
  Object.entries(PRIORITY_RANK)
    .map(([priority, rank]) => `WHEN '${priority}' THEN ${rank}`)
    .join(' ') +
  ' ELSE 0 END';

// Hesaplanan alan: hem SELECT'te (isOverdue) hem WHERE'de (overdue=true) aynı kural kullanılır
export const IS_OVERDUE_SQL =
  `("${WORK_ORDER_ALIAS}"."due_at" < now() ` +
  `AND "${WORK_ORDER_ALIAS}"."status" NOT IN (` +
  CLOSED_WORK_ORDER_STATUSES.map((status) => `'${status}'`).join(', ') +
  '))';

// Beyaz liste: kullanıcının gönderdiği sortBy yalnızca anahtar olarak aranır,
// SQL'e giden her zaman buradaki sabit değerdir
export const WORK_ORDER_SORT_COLUMNS: Record<string, string> = {
  createdAt: `${WORK_ORDER_ALIAS}.createdAt`,
  dueAt: `${WORK_ORDER_ALIAS}.dueAt`,
  priority: PRIORITY_RANK_SQL,
};

export function resolveWorkOrderSortColumn(sortBy: unknown): string {
  // hasOwn: "constructor", "__proto__" gibi nesne anahtarları da reddedilir
  if (typeof sortBy !== 'string' || !Object.hasOwn(WORK_ORDER_SORT_COLUMNS, sortBy)) {
    throw new RpcException({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Geçersiz sıralama alanı. İzin verilenler: createdAt, dueAt, priority',
    });
  }
  return WORK_ORDER_SORT_COLUMNS[sortBy];
}

export function resolveSortDirection(sortOrder: unknown): 'ASC' | 'DESC' {
  if (sortOrder === 'asc') return 'ASC';
  if (sortOrder === 'desc') return 'DESC';
  throw new RpcException({
    statusCode: HttpStatus.BAD_REQUEST,
    message: 'Geçersiz sıralama yönü. İzin verilenler: asc, desc',
  });
}
