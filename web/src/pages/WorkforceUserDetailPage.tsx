import { useQuery } from '@tanstack/react-query';
import { Breadcrumb, Button, Descriptions, Flex, Result, Skeleton, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { getWorkforceUser } from '../api/workforce-users.api';
import WorkforceUserFormModal from '../components/WorkforceUserFormModal';
import { formatPhone } from '../utils/phone';

const formatDate = (value: string) => dayjs(value).format('DD.MM.YYYY HH:mm');

export default function WorkforceUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: user, isLoading, isError } = useQuery({
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
        items={[
          { title: <Link to="/workforce-users">Personeller</Link> },
          { title: fullName },
        ]}
      />

      {isLoading || !user ? (
        <Skeleton active />
      ) : (
        <>
          <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
            <Typography.Title level={2} style={{ margin: 0 }}>
              {fullName}
            </Typography.Title>
            <Button type="primary" onClick={() => setModalOpen(true)}>
              Düzenle
            </Button>
          </Flex>

          <Descriptions bordered column={1}>
            <Descriptions.Item label="Sicil No">{user.registrationNumber}</Descriptions.Item>
            <Descriptions.Item label="Ad">{user.firstname}</Descriptions.Item>
            <Descriptions.Item label="Soyad">{user.lastname}</Descriptions.Item>
            <Descriptions.Item label="Telefon">{formatPhone(user.phone)}</Descriptions.Item>
            <Descriptions.Item label="Durum">
              {user.isActive ? (
                <Tag color="green">Aktif</Tag>
              ) : (
                <Tag color="default">Pasif</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Oluşturulma">
              {formatDate(user.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Son Güncelleme">
              {formatDate(user.updatedAt)}
            </Descriptions.Item>
          </Descriptions>

          <WorkforceUserFormModal
            open={modalOpen}
            workforceUser={user}
            onClose={() => setModalOpen(false)}
          />
        </>
      )}
    </>
  );
}
