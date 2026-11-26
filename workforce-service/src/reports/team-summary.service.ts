import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { isISO8601 } from 'class-validator';
import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { Team } from '../teams/entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { WorkOrderStatus } from '../work-orders/enums/work-order-status.enum';
import { CLOSED_WORK_ORDER_STATUSES } from '../work-orders/constants/work-order-list';
import { Shift } from '../shifts/entities/shift.entity';

export const TEAM_SUMMARY_MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

export type TeamSummaryQuery = { from: string; to: string };

export type TeamSummaryRow = {
  teamId: number;
  teamName: string;
  activeMemberCount: number;
  workOrders: Record<WorkOrderStatus, number> & { overdue: number };
  shiftHours: number;
};

export type TeamSummaryReport = {
  from: string;
  to: string;
  teams: TeamSummaryRow[];
};

type RawRow = {
  team_id: number;
  team_name: string;
  active_member_count: number;
  open: number;
  assigned: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  shift_hours: number;
};

@Injectable()
export class TeamSummaryService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Ekip bazlı özet raporu TEK bir SQL sorgusuyla üretir; ekip sayısı sorgu sayısını değiştirmez.
   *
   * Kapsam:
   * - İş emirleri: dueAt değeri [from, to) aralığına düşenler, ekibe göre gruplanır.
   *   Geciken = dueAt < şimdi ve durumu COMPLETED/CANCELLED değil (listedeki isOverdue ile aynı kural).
   * - Vardiya saati: ekibin (şu anki) üyelerinin [from, to) ile kesişen vardiyaları; yalnızca aralık
   *   içinde kalan kısım sayılır: least(end_at, to) - greatest(start_at, from).
   * - Aktif üye sayısı: is_active = true olan üyeler.
   *
   * Her tablo AYRI bir CTE'de kendi başına gruplanır, sonra ekip tablosuna LEFT JOIN edilir.
   * Üç tabloyu doğrudan join'leyip sonra GROUP BY yapmak satırları çoğaltırdı
   * (3 üye × 4 iş emri = 12 satır → sayılar şişer). LEFT JOIN + COALESCE sayesinde
   * hiç verisi olmayan ekipler de 0 değerleriyle gelir.
   */
  async getTeamSummary(query: TeamSummaryQuery, now: Date = new Date()): Promise<TeamSummaryReport> {
    const { from, to } = this.parseRange(query);

    const closed = CLOSED_WORK_ORDER_STATUSES.map((s) => `'${s}'`).join(', ');
    const countByStatus = (status: WorkOrderStatus, alias: string) =>
      `COUNT(*) FILTER (WHERE status = '${status}')::int AS ${alias}`;

    const rows: RawRow[] = await this.dataSource.query(
      `
      WITH member_counts AS (
        SELECT team_id, COUNT(*)::int AS active_member_count
        FROM ${this.table(WorkforceUser)}
        WHERE team_id IS NOT NULL AND is_active = true
        GROUP BY team_id
      ),
      work_order_counts AS (
        SELECT
          team_id,
          ${countByStatus(WorkOrderStatus.OPEN, 'open')},
          ${countByStatus(WorkOrderStatus.ASSIGNED, 'assigned')},
          ${countByStatus(WorkOrderStatus.IN_PROGRESS, 'in_progress')},
          ${countByStatus(WorkOrderStatus.COMPLETED, 'completed')},
          ${countByStatus(WorkOrderStatus.CANCELLED, 'cancelled')},
          COUNT(*) FILTER (WHERE due_at < $3 AND status NOT IN (${closed}))::int AS overdue
        FROM ${this.table(WorkOrder)}
        WHERE team_id IS NOT NULL
          AND due_at >= $1 AND due_at < $2
        GROUP BY team_id
      ),
      shift_hours AS (
        SELECT
          wu.team_id,
          SUM(EXTRACT(EPOCH FROM (LEAST(s.end_at, $2) - GREATEST(s.start_at, $1)))) / 3600 AS hours
        FROM ${this.table(Shift)} s
        JOIN ${this.table(WorkforceUser)} wu ON wu.id = s.workforce_user_id
        WHERE wu.team_id IS NOT NULL
          AND s.start_at < $2 AND s.end_at > $1
        GROUP BY wu.team_id
      )
      SELECT
        t.id   AS team_id,
        t.name AS team_name,
        COALESCE(mc.active_member_count, 0) AS active_member_count,
        COALESCE(wo.open, 0)        AS open,
        COALESCE(wo.assigned, 0)    AS assigned,
        COALESCE(wo.in_progress, 0) AS in_progress,
        COALESCE(wo.completed, 0)   AS completed,
        COALESCE(wo.cancelled, 0)   AS cancelled,
        COALESCE(wo.overdue, 0)     AS overdue,
        ROUND(COALESCE(sh.hours, 0)::numeric, 2)::float8 AS shift_hours
      FROM ${this.table(Team)} t
      LEFT JOIN member_counts mc     ON mc.team_id = t.id
      LEFT JOIN work_order_counts wo ON wo.team_id = t.id
      LEFT JOIN shift_hours sh       ON sh.team_id = t.id
      ORDER BY t.id
      `,
      [from, to, now],
    );

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      teams: rows.map((r) => ({
        teamId: r.team_id,
        teamName: r.team_name,
        activeMemberCount: r.active_member_count,
        workOrders: {
          [WorkOrderStatus.OPEN]: r.open,
          [WorkOrderStatus.ASSIGNED]: r.assigned,
          [WorkOrderStatus.IN_PROGRESS]: r.in_progress,
          [WorkOrderStatus.COMPLETED]: r.completed,
          [WorkOrderStatus.CANCELLED]: r.cancelled,
          overdue: r.overdue,
        },
        shiftHours: r.shift_hours,
      })),
    };
  }

  // api de doğrular; servis kendi başına da yanlış girdiyi kabul etmez
  private parseRange(query: TeamSummaryQuery): { from: Date; to: Date } {
    const valid = (v: unknown): v is string =>
      typeof v === 'string' && isISO8601(v, { strict: true, strictSeparator: true });
    const from = new Date(query?.from);
    const to = new Date(query?.to);
    const duration = to.getTime() - from.getTime();
    if (
      !valid(query?.from) || !valid(query?.to) ||
      !Number.isFinite(duration) || duration <= 0 || duration > TEAM_SUMMARY_MAX_RANGE_MS
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'Geçersiz tarih aralığı; aralık pozitif olmalı ve 31 günü aşmamalıdır',
      });
    }
    return { from, to };
  }

  // Şema ve tablo adı entity metadata'sından alınır (testler ayrı şema kullanır)
  private table(entity: EntityTarget<ObjectLiteral>): string {
    const metadata = this.dataSource.getMetadata(entity);
    const escape = (name: string) => this.dataSource.driver.escape(name);
    return metadata.schema
      ? `${escape(metadata.schema)}.${escape(metadata.tableName)}`
      : escape(metadata.tableName);
  }
}
