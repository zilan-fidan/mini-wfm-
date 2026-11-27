import { useQuery } from '@tanstack/react-query';
import { EditOutlined } from '@ant-design/icons';
import { Breadcrumb, Button, Card, Descriptions, Result, Skeleton, Tabs, Tag } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { getWorkforceUser } from '../api/workforce-users.api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusTag from '../components/StatusTag';
import NotificationList from '../components/NotificationList';
import TimesheetCard from '../components/TimesheetCard';
import WorkforceUserFormModal from '../components/WorkforceUserFormModal';
import { formatPhone } from '../utils/phone';

const formatDate = (value: string) => dayjs(value).format('DD.MM.YYYY HH:mm');

export default function WorkforceUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManage } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery({
    // 'workforce-users' ile başlıyor: modaldaki invalidateQueries bunu da yeniler
    queryKey: ['workforce-users', 'detail', id],
    queryFn: () => getWorkforceUser(id!),
    enabled: !!id,
  });

  if (isError) {
    return (
      <Result
        status="404"
        title="Personel bulunamadı"
        subTitle="Aradığınız personel mevcut değil ya da silinmiş olabilir."
        extra={
          <Button type="primary" onClick={() => navigate('/workforce-users')}>
            Listeye dön
          </Button>
        }
      />
    );
  }

  const fullName = user ? `${user.firstname} ${user.lastname}` : 'Yükleniyor...';

  return (
    <>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[{ title: <Link to="/workforce-users">Personeller</Link> }, { title: fullName }]}
      />

      {isLoading || !user ? (
        <Skeleton active />
      ) : (
        <>
          <PageHeader
            title={fullName}
            subtitle={`Sicil No: ${user.registrationNumber}`}
            extra={
              canManage && (
                <Button type="primary" icon={<EditOutlined />} onClick={() => setModalOpen(true)}>
                  Düzenle
                </Button>
              )
            }
          />

          <Card className="page-card">
            <Descriptions column={{ xs: 1, md: 2 }} colon={false} styles={{ label: { color: '#6b7389' } }}>
              <Descriptions.Item label="Sicil No">{user.registrationNumber}</Descriptions.Item>
              <Descriptions.Item label="Ad">{user.firstname}</Descriptions.Item>
              <Descriptions.Item label="Soyad">{user.lastname}</Descriptions.Item>
              <Descriptions.Item label="Telefon">{formatPhone(user.phone)}</Descriptions.Item>
              <Descriptions.Item label="Ekip">
                {user.team ? (
                  <Link to={`/teams/${user.team.id}`}>
                    <Tag color="geekblue" bordered={false} style={{ cursor: 'pointer' }}>
                      {user.team.name}
                    </Tag>
                  </Link>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Durum">
                <StatusTag isActive={user.isActive} />
              </Descriptions.Item>
              <Descriptions.Item label="Oluşturulma">{formatDate(user.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Son Güncelleme">{formatDate(user.updatedAt)}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Tabs
            style={{ marginTop: 20 }}
            items={[
              { key: 'timesheet', label: 'Puantaj', children: <TimesheetCard workforceUserId={user.id} /> },
              {
                key: 'notifications',
                label: 'Bildirimler',
                children: (
                  <Card className="page-card">
                    <NotificationList workforceUserId={user.id} />
                  </Card>
                ),
              },
            ]}
          />

          {canManage && (
            <WorkforceUserFormModal
              open={modalOpen}
              workforceUser={user}
              onClose={() => setModalOpen(false)}
            />
          )}
        </>
      )}
    </>
  );
}
