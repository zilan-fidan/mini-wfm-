import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Popconfirm, Table, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { Link } from 'react-router';
import { removeTeamMember } from '../api/teams.api';
import type { TeamDetail } from '../types/team';
import type { WorkforceUser } from '../types/workforce-user';
import { formatPhone } from '../utils/phone';
import AddTeamMemberModal from './AddTeamMemberModal';

type Props = {
  team: TeamDetail; // üyeler ekip detayıyla birlikte gelir
  loading?: boolean; // ekip detayı yeniden çekilirken
};

export default function TeamMembersCard({ team, loading }: Props) {
  const { members } = team;
  const queryClient = useQueryClient();
  const [addModalOpen, setAddModalOpen] = useState(false);

  const removeMutation = useMutation({
    mutationFn: (user: WorkforceUser) => removeTeamMember(team.id, user.id),
    onSuccess: (_, user) => {
      message.success(`${user.firstname} ${user.lastname} ekipten çıkarıldı`);
      // Üyelik hem ekip detayını (üyeler tablosu) hem personel listesini etkiler
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-users'] });
    },
  });

  const columns: ColumnsType<WorkforceUser> = [
    {
      title: 'Sicil No',
      dataIndex: 'registrationNumber',
      key: 'registrationNumber',
    },
    {
      title: 'Ad Soyad',
      key: 'fullName',
      render: (_, record) => (
        <Link to={`/workforce-users/${record.id}`}>
          {record.firstname} {record.lastname}
        </Link>
      ),
    },
    {
      title: 'Telefon',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string | null) => formatPhone(phone),
    },
    {
      title: 'İşlemler',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="Personeli ekipten çıkarmak istediğinize emin misiniz?"
          okText="Evet, Çıkar"
          cancelText="Vazgeç"
          okButtonProps={{ danger: true }}
          onConfirm={() => removeMutation.mutate(record)}
        >
          <Button
            size="small"
            danger
            loading={removeMutation.isPending && removeMutation.variables?.id === record.id}
          >
            Çıkar
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title={`Üyeler (${members.length})`}
      style={{ marginTop: 24 }}
      extra={
        // Pasif ekipte buton devre dışı; üzerine gelince nedeni görünür
        <Tooltip title={team.isActive ? undefined : 'Pasif bir ekibe üye eklenemez'}>
          <Button
            type="primary"
            disabled={!team.isActive}
            onClick={() => setAddModalOpen(true)}
          >
            Üye Ekle
          </Button>
        </Tooltip>
      }
    >
      <Table<WorkforceUser>
        rowKey="id"
        columns={columns}
        dataSource={members}
        loading={loading}
        pagination={false}
        locale={{ emptyText: 'Bu ekipte henüz üye yok' }}
      />

      <AddTeamMemberModal
        open={addModalOpen}
        team={team}
        onClose={() => setAddModalOpen(false)}
      />
    </Card>
  );
}
