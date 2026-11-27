import { useQuery } from '@tanstack/react-query';
import { Card, Col, DatePicker, Flex, Row, Statistic, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { Link } from 'react-router';
import { getTeamSummary } from '../api/reports.api';
import PageHeader from '../components/PageHeader';
import type { TeamSummaryRow } from '../types/report';
import type { WorkOrderStatus } from '../types/work-order';
import { formatHours, toIso } from '../utils/date';
import { STATUS_LABELS } from '../utils/work-order';
import './ReportsPage.css';

const MAX_DAYS = 31;
const STATUSES: WorkOrderStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

// Tek seri büyüklük: tek ton (mavi) yatay çubuk, değeri yanında metin olarak
function HoursBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <Tooltip title={formatHours(value)}>
      <div className="hours-bar">
        <div className="hours-bar__track">
          <div className="hours-bar__fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="hours-bar__value">{formatHours(value)}</span>
      </div>
    </Tooltip>
  );
}

export default function ReportsPage() {
  // Varsayılan: bu ayın başından bugüne kadar (bugün dahil)
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [dayjs().startOf('month'), dayjs().startOf('day')]);

  // Aralık [from, to): bitiş gününün tamamı dahil olsun diye ertesi gün 00:00 gönderilir
  const from = toIso(range[0].startOf('day'));
  const to = toIso(range[1].add(1, 'day').startOf('day'));

  const { data, isFetching } = useQuery({
    queryKey: ['reports', 'team-summary', from, to],
    queryFn: () => getTeamSummary(from, to),
  });

  const teams = data?.teams ?? [];
  const sum = (pick: (t: TeamSummaryRow) => number) => teams.reduce((acc, t) => acc + pick(t), 0);
  const maxHours = Math.max(0, ...teams.map((t) => t.shiftHours));
  const activeWork = sum((t) => t.workOrders.OPEN + t.workOrders.ASSIGNED + t.workOrders.IN_PROGRESS);

  const columns: ColumnsType<TeamSummaryRow> = [
    {
      title: 'Ekip',
      dataIndex: 'teamName',
      fixed: 'left',
      width: 180,
      sorter: (a, b) => a.teamName.localeCompare(b.teamName, 'tr'),
      render: (name: string, r) => (
        <Link to={`/teams/${r.teamId}`} style={{ fontWeight: 600 }}>
          {name.trim()}
        </Link>
      ),
    },
    {
      title: 'Aktif üye',
      dataIndex: 'activeMemberCount',
      align: 'right',
      width: 110,
      sorter: (a, b) => a.activeMemberCount - b.activeMemberCount,
    },
    ...STATUSES.map((status) => ({
      title: STATUS_LABELS[status],
      key: status,
      align: 'right' as const,
      width: status === 'IN_PROGRESS' ? 120 : 105,
      render: (_: unknown, r: TeamSummaryRow) => (
        <span className={r.workOrders[status] === 0 ? 'cell-zero' : undefined}>{r.workOrders[status]}</span>
      ),
    })),
    {
      title: 'Geciken',
      key: 'overdue',
      align: 'right',
      width: 105,
      sorter: (a, b) => a.workOrders.overdue - b.workOrders.overdue,
      render: (_, r) =>
        r.workOrders.overdue > 0 ? (
          <Typography.Text type="danger" strong>
            {r.workOrders.overdue}
          </Typography.Text>
        ) : (
          <span className="cell-zero">0</span>
        ),
    },
    {
      title: 'Vardiya saati',
      dataIndex: 'shiftHours',
      // genişlik verilmez: kalan alanı doldurur
      defaultSortOrder: 'descend',
      sorter: (a, b) => a.shiftHours - b.shiftHours,
      render: (v: number) => <HoursBar value={v} max={maxHours} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Ekip Özet Raporu"
        subtitle="Son tarihi seçilen aralıkta olan iş emirleri ve aralıktaki vardiya saatleri"
        extra={
          <DatePicker.RangePicker
            allowClear={false}
            format="DD.MM.YYYY"
            value={range}
            onChange={(v) => v?.[0] && v[1] && setRange([v[0], v[1]])}
            // Backend en fazla 31 gün kabul eder
            disabledDate={(current, { from: start }) =>
              !!start && Math.abs(current.diff(start, 'day')) >= MAX_DAYS
            }
            presets={[
              { label: 'Bu hafta', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
              { label: 'Bu ay', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
              { label: 'Geçen ay', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
              { label: 'Son 30 gün', value: [dayjs().subtract(29, 'day'), dayjs()] },
            ]}
          />
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Ekip', value: teams.length },
          { title: 'Aktif üye', value: sum((t) => t.activeMemberCount) },
          { title: 'Süren iş emri', value: activeWork },
          { title: 'Tamamlanan', value: sum((t) => t.workOrders.COMPLETED) },
          { title: 'Geciken', value: sum((t) => t.workOrders.overdue), danger: true },
          { title: 'Vardiya saati', value: formatHours(sum((t) => t.shiftHours)) },
        ].map((kpi) => (
          <Col xs={12} md={8} xl={4} key={kpi.title}>
            <Card className="page-card kpi-card" loading={isFetching && !data}>
              <Statistic
                title={kpi.title}
                value={kpi.value}
                valueStyle={kpi.danger && Number(kpi.value) > 0 ? { color: '#E5484D' } : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="page-card">
        <Flex justify="space-between" style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary">
            {range[0].format('DD.MM.YYYY')} – {range[1].format('DD.MM.YYYY')}
          </Typography.Text>
        </Flex>
        <Table<TeamSummaryRow>
          rowKey="teamId"
          size="middle"
          scroll={{ x: 1080 }}
          columns={columns}
          dataSource={teams}
          loading={isFetching}
          pagination={false}
          locale={{ emptyText: 'Ekip bulunamadı' }}
        />
      </Card>
    </>
  );
}
