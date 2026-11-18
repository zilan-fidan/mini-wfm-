import { RpcException } from '@nestjs/microservices';
import {IS_OVERDUE_SQL,PRIORITY_RANK_SQL,WORK_ORDER_SORT_COLUMNS,resolveSortDirection, resolveWorkOrderSortColumn,} from './work-order-list';

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as RpcException).getError() as { statusCode: number; message: string };
  }
  throw new Error('Hata bekleniyordu');
};

describe('İş emri listesi sıralama beyaz listesi', () => {
  it('yalnızca createdAt, dueAt ve priority izinlidir', () => {
    expect(Object.keys(WORK_ORDER_SORT_COLUMNS).sort()).toEqual(['createdAt', 'dueAt', 'priority']);
  });

  it.each([
    ['createdAt', 'wo.createdAt'],
    ['dueAt', 'wo.dueAt'],
    ['priority', PRIORITY_RANK_SQL],
  ])('sortBy=%s sabit SQL ifadesine çevrilir', (sortBy, expected) => {
    expect(resolveWorkOrderSortColumn(sortBy)).toBe(expected);
  });

  it.each([
    'name;DROP TABLE team',
    'name',
    'id',
    'wo.title',
    'createdAt DESC',
    '__proto__',
    'constructor',
    'toString',
    '',
    undefined,
    123,
  ])('sortBy=%p 400 ile reddedilir', (sortBy) => {
    const error = errorOf(() => resolveWorkOrderSortColumn(sortBy));
    expect(error.statusCode).toBe(400);
  });

  it('gelen değer hiçbir zaman SQL ifadesinin içine girmez', () => {
    const attack = 'name;DROP TABLE team';
    const error = errorOf(() => resolveWorkOrderSortColumn(attack));
    expect(error.message).not.toContain(attack);
    Object.values(WORK_ORDER_SORT_COLUMNS).forEach((sql) => expect(sql).not.toContain('DROP'));
  });

  it.each([
    ['asc', 'ASC'],
    ['desc', 'DESC'],
  ])('sortOrder=%s → %s', (sortOrder, expected) => {
    expect(resolveSortDirection(sortOrder)).toBe(expected);
  });

  it.each(['ASC', 'up', 'desc;--', undefined])('sortOrder=%p 400 ile reddedilir', (sortOrder) => {
    expect(errorOf(() => resolveSortDirection(sortOrder)).statusCode).toBe(400);
  });
});

describe('Hesaplanan alan SQL parçaları', () => {
  it('öncelik sıralaması önem sırasına göre puan verir', () => {
    expect(PRIORITY_RANK_SQL).toBe(
      `CASE "wo"."priority" WHEN 'URGENT' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END`,
    );
  });

  it('isOverdue kapanmış durumları dışarıda bırakır', () => {
    expect(IS_OVERDUE_SQL).toBe(`("wo"."due_at" < now() AND "wo"."status" NOT IN ('COMPLETED', 'CANCELLED'))`);
  });
});
