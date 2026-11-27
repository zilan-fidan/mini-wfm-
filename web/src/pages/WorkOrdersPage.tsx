import { ClockCircleOutlined, ExclamationCircleOutlined, FileTextOutlined, PlusOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Card, Checkbox, Col, Empty, Flex, Input, Row, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType, SorterResult } from 'antd/es/table/interface';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listTeams } from '../api/teams.api';
import KpiCard from '../components/dashboard/KpiCard';
import WeeklyBarChart, { type WeeklyPoint } from '../components/dashboard/WeeklyBarChart';
import { listWorkOrders } from '../api/work-orders.api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import TeamSelect from '../components/TeamSelect';
import WorkOrderFormModal from '../components/WorkOrderFormModal';
import { OverdueBadge, PriorityBadge, StatusBadge } from '../components/WorkOrderTags';
import type { ListWorkOrdersParams, WorkOrder, WorkOrderPriority, WorkOrderStatus } from '../types/work-order';
import { formatDateTime } from '../utils/date';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '../utils/work-order';

type SortBy = NonNullable<ListWorkOrdersParams['sortBy']>;

export default function WorkOrdersPage() {
  const { canPlan } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [urlParams] = useSearchParams();
  const urlSearch = urlParams.get('search') ?? '';
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [search, setSearch] = useState(urlSearch);

  // URL'deki arama değiştiğinde kutuyu güncelle.
  const [lastUrlSearch, setLastUrlSearch] = useState(urlSearch);
  if (urlSearch !== lastUrlSearch) {
    setLastUrlSearch(urlSearch);
    setSearchInput(urlSearch);
  }
  const [status, setStatus] = useState<WorkOrderStatus[]>([]);
  const [priority, setPriority] = useState<WorkOrderPriority>();
  const [teamId, setTeamId] = useState<number>();
  const [overdue, setOverdue] = useState(false);
  const [sort, setSort] = useState<{ sortBy: SortBy; sortOrder: 'asc' | 'desc' }>({ sortBy: 'createdAt', sortOrder: 'desc' });
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return;

    const timer = setTimeout(() => {
      setSearch(nextSearch);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const params: ListWorkOrdersParams = {
    page,
    limit: pageSize,
    search: search || undefined,
    status: status.length ? status : undefined,
    priority,
    teamId,
    overdue: overdue || undefined,
    ...sort,
  };

  const { data, isFetching } = useQuery({
    queryKey: ['work-orders', params],
    queryFn: () => listWorkOrders(params),
    placeholderData: keepPreviousData,
  });

  // ---- Özet (filtrelerden bağımsız) ----
  const ACTIVE: WorkOrderStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS'];
  const total = useQuery({ queryKey: ['work-orders', 'kpi', 'total'], queryFn: () => listWorkOrders({ limit: 1 }) });
  const active = useQuery({ queryKey: ['work-orders', 'kpi', 'active'], queryFn: () => listWorkOrders({ limit: 1, status: ACTIVE }) });
  const urgent = useQuery({
    queryKey: ['work-orders', 'kpi', 'urgent'],
    queryFn: () => listWorkOrders({ limit: 1, status: ACTIVE, priority: 'URGENT' }),
  });
  const overdueKpi = useQuery({ queryKey: ['work-orders', 'kpi', 'overdue'], queryFn: () => listWorkOrders({ limit: 1, overdue: true }) });
  const activeTeams = useQuery({ queryKey: ['teams', 'kpi', 'active'], queryFn: () => listTeams({ limit: 1, isActive: true }) });
  // Ekip durumu ve haftalık dağılım son 100 iş emrinden hesaplanır
  const recent = useQuery({
    queryKey: ['work-orders', 'recent'],
    queryFn: () => listWorkOrders({ limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }),
  });

  const teamStatus = useMemo(() => {
    const map = new Map<number, { id: number; name: string; total: number; completed: number; byStatus: Record<string, number> }>();
    for (const wo of recent.data?.data ?? []) {
      if (!wo.team || wo.status === 'CANCELLED') continue;
      const row = map.get(wo.team.id) ?? { id: wo.team.id, name: wo.team.name, total: 0, completed: 0, byStatus: {} };
      row.total += 1;
      if (wo.status === 'COMPLETED') row.completed += 1;
      row.byStatus[wo.status] = (row.byStatus[wo.status] ?? 0) + 1;
      map.set(wo.team.id, row);
    }
    return [...map.values()]
      .map((r) => {
        const activeEntries = Object.entries(r.byStatus).filter(([st]) => st !== 'COMPLETED');
        const main = (activeEntries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'COMPLETED') as WorkOrderStatus;
        return { ...r, main, active: r.total - r.completed, pct: Math.round((r.completed / r.total) * 100) };
      })
      .sort((a, b) => b.active - a.active || b.total - a.total)
      .slice(0, 5);
  }, [recent.data]);

  const weekly = useMemo<WeeklyPoint[]>(() => {
    const start = dayjs().startOf('week');
    const list = recent.data?.data ?? [];
    return Array.from({ length: 7 }, (_, i) => {
      const day = start.add(i, 'day');
      return {
        label: day.format('ddd'),
        fullLabel: day.format('D MMMM dddd'),
        a: list.filter((wo) => dayjs(wo.createdAt).isSame(day, 'day')).length,
        b: list.filter((wo) => dayjs(wo.dueAt).isSame(day, 'day')).length,
      };
    });
  }, [recent.data]);

  // Filtre değişince ilk sayfaya dön
  const withReset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  const sortOrderOf = (key: SortBy) =>
    sort.sortBy === key ? (sort.sortOrder === 'asc' ? 'ascend' : 'descend') : null;

  const columns: ColumnsType<WorkOrder> = [
    {
      title: 'Kod',
      dataIndex: 'code',
      width: 140,
      render: (code: string, r) => (
        <Link to={`/work-orders/${r.id}`} style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {code}
        </Link>
      ),
    },
    {
      title: 'Başlık',
      dataIndex: 'title',
      ellipsis: true,
      render: (title: string, r) => (
        <Flex vertical>
          <Typography.Text strong ellipsis>
            {title}
          </Typography.Text>
          {r.description && (
            <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
              {r.description}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    { title: 'Durum', dataIndex: 'status', width: 130, render: (s: WorkOrderStatus) => <StatusBadge status={s} /> },
    {
      title: 'Öncelik',
      dataIndex: 'priority',
      width: 110,
      sorter: true,
      sortOrder: sortOrderOf('priority'),
      render: (p: WorkOrderPriority) => <PriorityBadge priority={p} />,
    },
    {
      title: 'Ekip',
      key: 'team',
      width: 180,
      render: (_, r) => (r.team ? <Link to={`/teams/${r.team.id}`}>{r.team.name}</Link> : <Typography.Text type="secondary">Atanmadı</Typography.Text>),
    },
    {
      title: 'Son tarih',
      dataIndex: 'dueAt',
      width: 190,
      sorter: true,
      sortOrder: sortOrderOf('dueAt'),
      render: (dueAt: string, r) => (
        <Space size={4} wrap>
          <span>{formatDateTime(dueAt)}</span>
          {r.isOverdue && <OverdueBadge />}
        </Space>
      ),
    },
    {
      title: 'Oluşturulma',
      dataIndex: 'createdAt',
      width: 145,
      sorter: true,
      sortOrder: sortOrderOf('createdAt'),
      render: (v: string) => dayjs(v).format('DD.MM.YYYY'),
    },
  ];

  return (
    <>
      <PageHeader
        title="İş Emirleri"
        extra={
          <Space wrap style={{ marginInlineStart: 'auto' }}>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: '#8a8fa8' }} />}
              aria-label="İş emri ara"
              placeholder="Kod veya başlık ara..."
              style={{ width: 200 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={() => withReset(setSearch)(searchInput.trim())}
            />
            <Select<WorkOrderStatus[]>
              mode="multiple"
              allowClear
              placeholder="Tüm durumlar"
              maxTagCount="responsive"
              style={{ width: 190 }}
              options={STATUS_OPTIONS}
              value={status}
              onChange={withReset(setStatus)}
            />
            <TeamSelect value={teamId} onChange={withReset(setTeamId)} placeholder="Tüm ekipler" style={{ width: 170 }} />
            {canPlan && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                Yeni İş Emri
              </Button>
            )}
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            icon={<FileTextOutlined />}
            title="Toplam İş Emri"
            value={total.data?.total ?? 0}
            loading={total.isLoading}
            badge={active.data ? `${active.data.total} aktif` : undefined}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            icon={<TeamOutlined />}
            title="Aktif Saha Ekibi"
            value={activeTeams.data?.total ?? 0}
            loading={activeTeams.isLoading}
            badge={recent.data ? `${teamStatus.filter((t) => t.active > 0).length} görevde` : undefined}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            icon={<ExclamationCircleOutlined />}
            tone="danger"
            title="Acil Müdahale"
            value={urgent.data?.total ?? 0}
            loading={urgent.isLoading}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            icon={<ClockCircleOutlined />}
            tone="navy"
            title="Geciken"
            value={overdueKpi.data?.total ?? 0}
            loading={overdueKpi.isLoading}
            badge={overdueKpi.data ? (overdueKpi.data.total > 0 ? 'Takip et' : 'Yok') : undefined}
            badgeTone={overdueKpi.data && overdueKpi.data.total > 0 ? 'danger' : 'success'}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card className="page-card dash-card" title="Saha Operasyon & Ekip Durumu" loading={recent.isLoading} style={{ height: '100%' }}>
            {teamStatus.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Ekibe atanmış iş emri yok" />
            ) : (
              <div className="team-status">
                {teamStatus.map((t) => (
                  <div className="team-status__row" key={t.id}>
                    <div className="team-status__icon">
                      <TeamOutlined />
                    </div>
                    <div className="team-status__main">
                      <div className="team-status__head">
                        <Link to={`/teams/${t.id}`} className="team-status__name">
                          {t.name}
                        </Link>
                        <StatusBadge status={t.main} />
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {t.completed}/{t.total} tamamlandı
                        </Typography.Text>
                        <span className="team-status__pct">%{t.pct}</span>
                      </div>
                      <div className="team-status__track" role="progressbar" aria-valuenow={t.pct} aria-valuemin={0} aria-valuemax={100}>
                        <div className="team-status__fill" style={{ width: `${t.pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            className="page-card dash-card"
            title="Haftalık İş Emri Dağılımı"
            extra={<Typography.Text type="secondary">Bu hafta</Typography.Text>}
            loading={recent.isLoading}
            style={{ height: '100%' }}
          >
            <WeeklyBarChart data={weekly} seriesA="Oluşturulan" seriesB="Son tarihi gelen" />
          </Card>
        </Col>
      </Row>

      <Card
        className="page-card dash-card"
        title={data ? `İş Emri Listesi (${data.total})` : 'İş Emri Listesi'}
        extra={
          <Space wrap>
            <Select<WorkOrderPriority>
              allowClear
              placeholder="Tüm öncelikler"
              style={{ width: 150 }}
              options={PRIORITY_OPTIONS}
              value={priority}
              onChange={withReset(setPriority)}
            />
            <Checkbox checked={overdue} onChange={(e) => withReset(setOverdue)(e.target.checked)}>
              Sadece gecikenler
            </Checkbox>
          </Space>
        }
      >
        <Table<WorkOrder>
          rowKey="id"
          scroll={{ x: 1000 }}
          columns={columns}
          dataSource={data?.data}
          loading={isFetching}
          locale={{ emptyText: 'Kayıt bulunamadı' }}
          rowClassName={(r) => (r.isOverdue ? 'row-overdue' : '')}
          onChange={(_, __, sorter) => {
            const s = sorter as SorterResult<WorkOrder>;
            const field = s.column ? ((s.column as { dataIndex?: string }).dataIndex as SortBy) : 'createdAt';
            setSort({ sortBy: field, sortOrder: s.order === 'ascend' ? 'asc' : 'desc' });
          }}
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            onChange: (newPage, newPageSize) => {
              if (newPageSize !== pageSize) {
                setPageSize(newPageSize);
                setPage(1);
              } else {
                setPage(newPage);
              }
            },
          }}
        />
      </Card>

      {canPlan && <WorkOrderFormModal open={modalOpen} workOrder={null} onClose={() => setModalOpen(false)} />}
    </>
  );
}
