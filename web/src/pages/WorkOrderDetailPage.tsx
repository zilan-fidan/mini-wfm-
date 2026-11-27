import { EditOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Breadcrumb, Button, Card, Col, Descriptions, Empty, Result, Row, Skeleton, Space, Timeline, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { getTeam } from '../api/teams.api';
import { getWorkOrder, getWorkOrderHistory } from '../api/work-orders.api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusChangeModal from '../components/StatusChangeModal';
import WorkOrderFormModal from '../components/WorkOrderFormModal';
import { OverdueBadge, PriorityBadge, StatusBadge } from '../components/WorkOrderTags';
import { formatDateTime } from '../utils/date';
import { availableTransitions, STATUS_LABELS, type Transition } from '../utils/work-order';
import type { WorkOrderStatus } from '../types/work-order';

const CLOSED = ['COMPLETED', 'CANCELLED'];

const TIMELINE_COLORS: Record<WorkOrderStatus, string> = {
  OPEN: 'var(--lilac-accent)',
  ASSIGNED: 'var(--assigned-status-color, #2F54EB)',
  IN_PROGRESS: '#F7B32B',
  COMPLETED: '#22A06B',
  CANCELLED: '#9AA3B5',
};

export default function WorkOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, canPlan } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [transition, setTransition] = useState<Transition | null>(null);

  const { data: wo, isLoading, isError } = useQuery({
    queryKey: ['work-orders', 'detail', id],
    queryFn: () => getWorkOrder(id!),
    enabled: !!id,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['work-orders', 'history', id],
    queryFn: () => getWorkOrderHistory(id!),
    enabled: !!id,
  });

  // Detay cevabında yalnızca teamId var; adı için ekip okunur
  const { data: team } = useQuery({
    queryKey: ['teams', 'detail', String(wo?.teamId)],
    queryFn: () => getTeam(wo!.teamId!),
    enabled: !!wo?.teamId,
  });

  if (isError) {
    return (
      <Result
        status="404"
        title="İş emri bulunamadı"
        extra={
          <Button type="primary" onClick={() => navigate('/work-orders')}>
            Listeye dön
          </Button>
        }
      />
    );
  }

  const isOverdue = wo && !CLOSED.includes(wo.status) && dayjs(wo.dueAt).isBefore(dayjs());
  const transitions = wo && user && canPlan ? availableTransitions(wo.status, user.role) : [];

  return (
    <>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[{ title: <Link to="/work-orders">İş Emirleri</Link> }, { title: wo?.code ?? 'Yükleniyor...' }]}
      />

      {isLoading || !wo ? (
        <Skeleton active />
      ) : (
        <>
          <PageHeader
            title={wo.title}
            subtitle={
              <Space size={6} wrap>
                <span>{wo.code}</span>
                <StatusBadge status={wo.status} />
                <PriorityBadge priority={wo.priority} />
                {isOverdue && <OverdueBadge />}
              </Space>
            }
            extra={
              canPlan && (
                <Space wrap>
                  {!CLOSED.includes(wo.status) && (
                    <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                      Düzenle
                    </Button>
                  )}
                  {transitions.map((t, i) => (
                    <Button
                      key={t.to}
                      type={i === 0 ? 'primary' : 'default'}
                      danger={t.to === 'CANCELLED'}
                      onClick={() => setTransition(t)}
                    >
                      {t.action}
                    </Button>
                  ))}
                </Space>
              )
            }
          />

          <Row gutter={[20, 20]}>
            <Col xs={24} lg={15}>
              <Card className="page-card" title="Bilgiler">
                <Descriptions column={{ xs: 1, md: 2 }} colon={false} styles={{ label: { color: '#6b7389' } }}>
                  <Descriptions.Item label="Ekip">
                    {wo.teamId ? <Link to={`/teams/${wo.teamId}`}>{team?.name ?? `#${wo.teamId}`}</Link> : 'Atanmadı'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Son tarih">
                    <Typography.Text type={isOverdue ? 'danger' : undefined}>{formatDateTime(wo.dueAt)}</Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Oluşturulma">{formatDateTime(wo.createdAt)}</Descriptions.Item>
                  <Descriptions.Item label="Son güncelleme">{formatDateTime(wo.updatedAt)}</Descriptions.Item>
                  <Descriptions.Item label="Açıklama" span={2}>
                    {wo.description || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            <Col xs={24} lg={9}>
              <Card className="page-card" title="Durum geçmişi">
                {historyLoading ? (
                  <Skeleton active />
                ) : !history?.length ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Geçmiş kaydı yok" />
                ) : (
                  <Timeline
                    items={[...(history ?? [])].reverse().map((h) => ({
                      color: TIMELINE_COLORS[h.toStatus],
                      children: (
                        <>
                          <Typography.Text strong>
                            {h.fromStatus ? `${STATUS_LABELS[h.fromStatus]} → ` : ''}
                            {STATUS_LABELS[h.toStatus]}
                          </Typography.Text>
                          <div style={{ fontSize: 12, color: '#8a92a6' }}>
                            {formatDateTime(h.changedAt)} · {h.changedByUsername}
                          </div>
                          {h.reason && <div style={{ marginTop: 4 }}>“{h.reason}”</div>}
                        </>
                      ),
                    }))}
                  />
                )}
              </Card>
            </Col>
          </Row>

          {canPlan && (
            <>
              <WorkOrderFormModal open={editOpen} workOrder={wo} onClose={() => setEditOpen(false)} />
              <StatusChangeModal workOrder={wo} transition={transition} onClose={() => setTransition(null)} />
            </>
          )}
        </>
      )}
    </>
  );
}
