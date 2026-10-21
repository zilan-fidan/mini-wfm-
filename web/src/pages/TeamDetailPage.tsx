import { useQuery } from '@tanstack/react-query';
import {Breadcrumb,Button,  Descriptions,Flex,Result,Skeleton,Tag,Typography,} from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { getTeam } from '../api/teams.api';
import TeamFormModal from '../components/TeamFormModal';

const formatDate = (value: string) => dayjs(value).format('DD.MM.YYYY HH:mm');

export default function TeamDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: team, isLoading, isError } = useQuery({
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
        items={[
          { title: <Link to="/teams">Ekipler</Link> },
          { title: team?.name ?? 'Yükleniyor...' },
        ]}
      />

      {isLoading || !team ? (
        <Skeleton active />
      ) : (
        <>
          <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
            <Typography.Title level={2} style={{ margin: 0 }}>
              {team.name}
            </Typography.Title>
            <Button type="primary" onClick={() => setModalOpen(true)}>
              Düzenle
            </Button>
          </Flex>

          <Descriptions bordered column={1}>
            <Descriptions.Item label="Ad">{team.name}</Descriptions.Item>
            <Descriptions.Item label="Açıklama">
              {team.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Durum">
              {team.isActive ? (
                <Tag color="green">Aktif</Tag>
              ) : (
                <Tag color="default">Pasif</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Oluşturulma">
              {formatDate(team.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Son Güncelleme">
              {formatDate(team.updatedAt)}
            </Descriptions.Item>
          </Descriptions>

          <TeamFormModal
            open={modalOpen}
            team={team}
            onClose={() => setModalOpen(false)}
          />
        </>
      )}
    </>
  );
}