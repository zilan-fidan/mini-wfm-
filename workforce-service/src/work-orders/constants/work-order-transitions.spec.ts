import { WorkOrderStatus } from '../enums/work-order-status.enum';
import { WORK_ORDER_TRANSITIONS,WORK_ORDER_STATUS_LABELS,} from './work-order-transitions';

describe('Work Order Status Transitions (B19)', () => {
  const allowedTransitions: [WorkOrderStatus, WorkOrderStatus][] = [
    [WorkOrderStatus.OPEN, WorkOrderStatus.ASSIGNED],
    [WorkOrderStatus.OPEN, WorkOrderStatus.CANCELLED],

    [WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS],
    [WorkOrderStatus.ASSIGNED, WorkOrderStatus.OPEN],
    [WorkOrderStatus.ASSIGNED, WorkOrderStatus.CANCELLED],

    [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.COMPLETED],
    [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  ];

  it.each(allowedTransitions)(
    '%s -> %s geçişine izin vermeli',
    (fromStatus, toStatus) => {
      const allowed = WORK_ORDER_TRANSITIONS[fromStatus];

      expect(allowed).toContain(toStatus);
    },
  );

  const forbiddenTransitions: [WorkOrderStatus, WorkOrderStatus][] = [
    [WorkOrderStatus.OPEN, WorkOrderStatus.COMPLETED],
    [WorkOrderStatus.COMPLETED, WorkOrderStatus.OPEN],
    [WorkOrderStatus.CANCELLED, WorkOrderStatus.ASSIGNED],
    [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.OPEN],
  ];

  it.each(forbiddenTransitions)(
    '%s -> %s geçişine izin vermemeli',
    (fromStatus, toStatus) => {
      const allowed = WORK_ORDER_TRANSITIONS[fromStatus];

      expect(allowed).not.toContain(toStatus);
    },
  );

  it('tüm durumların geçiş tablosunda tanımlı olduğunu doğrulamalı', () => {
    const statuses = Object.values(WorkOrderStatus);

    for (const status of statuses) {
      expect(WORK_ORDER_TRANSITIONS).toHaveProperty(status);
      expect(WORK_ORDER_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('COMPLETED durumundan çıkış olmamalı', () => {
    expect(
      WORK_ORDER_TRANSITIONS[WorkOrderStatus.COMPLETED],
    ).toEqual([]);
  });

  it('CANCELLED durumundan çıkış olmamalı', () => {
    expect(
      WORK_ORDER_TRANSITIONS[WorkOrderStatus.CANCELLED],
    ).toEqual([]);
  });
});
