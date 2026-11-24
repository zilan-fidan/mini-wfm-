import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { Team } from '../../teams/entities/team.entity';
import { WorkforceUser } from '../../workforce-users/entities/workforce-user.entity';
import { WorkOrder } from '../entities/work-order.entity';
import { WorkOrderStatus } from '../enums/work-order-status.enum';
import { WORK_ORDER_OVERDUE, WorkOrderEventDraft } from '../../events/work-order-events';

// Kapanmamış durumlar. COMPLETED ve CANCELLED iş emirleri için gecikme olayı çıkmaz.
export const OPEN_WORK_ORDER_STATUSES = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS,
] as const;

// Bir çalışmada en fazla bu kadar kayıt sahiplenilir; kalanlar sonraki çalışmaya kalır
export const OVERDUE_BATCH_SIZE = 500;

export interface OverdueClaim {
  workOrderId: number;
  claimedAt: Date;
  // Aynı (iş emri, dueAt) için her zaman aynı değer: tekrar denemede tüketici yinelemeyi tanır
  eventId: string;
  draft: WorkOrderEventDraft;
}

type ClaimedRow = {
  id: number;
  code: string;
  title: string;
  team_id: number | null;
  due_at: Date;
  status: string;
  priority: string;
  version: number;
};

/**
 * workOrderOverdue olayının kimliği iş emri ve dueAt'ten türetilir (UUID biçiminde SHA-256 özeti).
 * - Yayın başarısız olup tekrar denenirse aynı eventId gider → tüketici ikinci bildirimi yazmaz (P8).
 * - dueAt ileri alınıp yeni süre de geçerse dueAt değiştiği için yeni eventId → yeni bildirim.
 */
export function overdueEventId(workOrderId: number, dueAt: Date): string {
  const hex = createHash('sha256')
    .update(`${WORK_ORDER_OVERDUE}:${workOrderId}:${dueAt.toISOString()}`)
    .digest('hex');
  // RFC 4122 biçimi: sürüm nibble'ı 5 (isim tabanlı), varyant 10xx
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

@Injectable()
export class OverdueWorkOrdersService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Süresi geçmiş, kapanmamış ve henüz bildirilmemiş iş emirlerini sahiplenir:
   * aynı transaction içinde overdue_notified_at doldurulur ve olay taslakları hazırlanır.
   *
   * Tekrar çalışmayı engelleyen şey bu tek UPDATE'tir:
   * - `overdue_notified_at IS NULL` koşulu: bir kez sahiplenilen kayıt sonraki çalışmalarda gelmez.
   * - `FOR UPDATE SKIP LOCKED`: servisin birden fazla kopyası aynı anda çalışırsa, bir kopyanın
   *   kilitlediği satırı diğeri beklemeden atlar. Her kayıt tam olarak bir kopya tarafından alınır.
   *
   * Ham SQL kullanılıyor çünkü TypeORM'un update builder'ı @VersionColumn'u da artırır.
   * Bu bir sistem işaretidir; kullanıcının elindeki version'ı eskitip 409'a yol açmamalı.
   */
  async claimOverdue(now: Date = new Date(), limit = OVERDUE_BATCH_SIZE): Promise<OverdueClaim[]> {
    return this.dataSource.transaction(async (manager) => {
      const statuses = OPEN_WORK_ORDER_STATUSES.map((s) => `'${s}'`).join(', ');

      // useStructuredResult: TypeORM düz query() ile UPDATE için [satırlar, sayı] döndürür
      const { records: rows } = await manager.queryRunner!.query(
        `
        WITH due AS (
          SELECT id
          FROM ${this.workOrderTable(manager)}
          WHERE overdue_notified_at IS NULL
            AND status IN (${statuses})
            AND due_at <= $1
          ORDER BY due_at, id
          LIMIT $2
          FOR UPDATE SKIP LOCKED
        )
        UPDATE ${this.workOrderTable(manager)} AS wo
        SET overdue_notified_at = $1
        FROM due
        WHERE wo.id = due.id
        RETURNING wo.id, wo.code, wo.title, wo.team_id, wo.due_at, wo.status, wo.priority, wo.version
        `,
        [now, limit],
        true,
      ) as { records: ClaimedRow[] };

      if (rows.length === 0) {
        return [];
      }

      // Ekip ve aktif üyeler aynı transaction'da, tek sorguda okunur (iş emri başına sorgu yok)
      const teamIds = [...new Set(rows.map((r) => r.team_id).filter((id): id is number => id !== null))];
      const [teams, members] = teamIds.length
        ? await Promise.all([
            manager.getRepository(Team).find({ select: { id: true, name: true }, where: { id: In(teamIds) } }),
            manager.getRepository(WorkforceUser).find({
              select: { id: true, firstname: true, lastname: true, teamId: true },
              where: { teamId: In(teamIds), isActive: true },
              order: { id: 'ASC' },
            }),
          ])
        : [[], []];

      const teamById = new Map(teams.map((t) => [t.id, t]));
      const occurredAt = now.toISOString();

      return rows
        .sort((a, b) => a.id - b.id)
        .map((row) => {
          const dueAt = new Date(row.due_at);
          const team = row.team_id !== null ? teamById.get(row.team_id) : undefined;

          return {
            workOrderId: row.id,
            claimedAt: now,
            eventId: overdueEventId(row.id, dueAt),
            draft: {
              eventType: WORK_ORDER_OVERDUE,
              occurredAt,
              workOrder: {
                id: row.id,
                code: row.code,
                title: row.title,
                version: row.version,
                priority: row.priority,
                status: row.status,
                dueAt: dueAt.toISOString(),
              },
              team: team ? { id: team.id, name: team.name } : null,
              members: members
                .filter((m) => team && m.teamId === team.id)
                .map(({ id, firstname, lastname }) => ({ id, firstname, lastname })),
            },
          };
        });
    });
  }

  /**
   * Yayın başarısız olursa sahiplenmeyi geri alır; kayıt bir sonraki çalışmada tekrar denenir.
   * `= claimedAt` koşulu: arada dueAt güncellenip alan sıfırlandıysa ya da başka bir çalışma
   * yeniden sahiplendiyse onun değerine dokunulmaz.
   */
  async releaseClaim(workOrderId: number, claimedAt: Date): Promise<void> {
    await this.dataSource.query(
      `UPDATE ${this.workOrderTable(this.dataSource.manager)}
       SET overdue_notified_at = NULL
       WHERE id = $1 AND overdue_notified_at = $2`,
      [workOrderId, claimedAt],
    );
  }

  // Şema adı entity metadata'sından alınır (testler ayrı şema kullanır)
  private workOrderTable(manager: EntityManager): string {
    const metadata = manager.connection.getMetadata(WorkOrder);
    const escape = (name: string) => manager.connection.driver.escape(name);
    return metadata.schema
      ? `${escape(metadata.schema)}.${escape(metadata.tableName)}`
      : escape(metadata.tableName);
  }
}
