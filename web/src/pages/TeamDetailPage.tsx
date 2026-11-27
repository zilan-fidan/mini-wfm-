import { useQuery } from '@tanstack/react-query';
import { CalendarOutlined, EditOutlined, ScheduleOutlined } from '@ant-design/icons';
import { Breadcrumb, Button, Card, Descriptions, Result, Skeleton, Space, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { getTeam } from '../api/teams.api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusTag from '../components/StatusTag';
import TeamFormModal from '../components/TeamFormModal';
import RotationPlanModal from '../components/RotationPlanModal';
import TeamMembersCard from '../components/TeamMembersCard';
import TeamShiftModal from '../components/TeamShiftModal';

const formatDate = (value: string) => dayjs(value).format('DD.MM.YYYY HH:mm');

export default function TeamDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManage, canPlan } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [planModal, setPlanModal] = useState<'shift' | 'rotation' | null>(null);

  const {
    data: team,
    isLoading,
    isFetching,
    isError,
  } = useQuery({
    // 'teams' ile başlıyor: modaldaki invalidateQueries(['teams']) bunu da yeniler
    queryKey: ['teams', 'detail', id],
    queryFn: () => getTeam(id!),
    enabled: !!id,
  });

  if (isError) {
    return (
      <Result
        status="404"
        title="Ekip bulunamadı"
        subTitle="Aradığınız ekip mevcut değil ya da silinmiş olabilir."
        extra={
          <Button type="primary" onClick={() => navigate('/teams')}>
            Listeye dön
          </Button>
        }
      />
    );
  }

  return (
    <>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[{ title: <Link to="/teams">Ekipler</Link> }, { title: team?.name ?? 'Yükleniyor...' }]}
      />

      {isLoading || !team ? (
        <Skeleton active />
      ) : (
        <>
          <PageHeader
            title={team.name}
            subtitle={team.description || 'Ekip detayları'}
            extra={
              <Space wrap>
                {canPlan && (
                  // Pasif ekibe vardiya atanamaz
                  <Tooltip title={team.isActive ? undefined : 'Pasif ekibe vardiya atanamaz'}>
                    <Space.Compact>
                      <Button icon={<CalendarOutlined />} disabled={!team.isActive} onClick={() => setPlanModal('shift')}>
                        Toplu Vardiya
                      </Button>
                      <Button icon={<ScheduleOutlined />} disabled={!team.isActive} onClick={() => setPlanModal('rotation')}>
                        Rotasyon Planı
                      </Button>
                    </Space.Compact>
                  </Tooltip>
                )}
                {canManage && (
                  <Button type="primary" icon={<EditOutlined />} onClick={() => setModalOpen(true)}>
                    Düzenle
                  </Button>
                )}
              </Space>
            }
          />

          <Card className="page-card">
            <Descriptions column={{ xs: 1, md: 2 }} colon={false} styles={{ label: { color: '#6b7389' } }}>
              <Descriptions.Item label="Ad">{team.name}</Descriptions.Item>
              <Descriptions.Item label="Açıklama">{team.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="Durum">
                <StatusTag isActive={team.isActive} />
              </Descriptions.Item>
              <Descriptions.Item label="Oluşturulma">{formatDate(team.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Son Güncelleme">{formatDate(team.updatedAt)}</Descriptions.Item>
            </Descriptions>
          </Card>

          <TeamMembersCard team={team} loading={isFetching} />

          {canPlan && (
            <>
              <TeamShiftModal open={planModal === 'shift'} teamId={team.id} onClose={() => setPlanModal(null)} />
              <RotationPlanModal
                open={planModal === 'rotation'}
                teamId={team.id}
                teamName={team.name}
                onClose={() => setPlanModal(null)}
              />
            </>
          )}

          {canManage && <TeamFormModal open={modalOpen} team={team} onClose={() => setModalOpen(false)} />}
        </>
      )}
    </>
  );
}
