import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { addTeamMember, removeTeamMember } from '../api/teams.api';
import { listWorkforceUsers } from '../api/workforce-users.api';
import type { TeamDetail } from '../types/team';
import type { WorkforceUser } from '../types/workforce-user';
import { formatPhone } from '../utils/phone';

type Props = {
  team: TeamDetail; // üyeler ekip detayıyla birlikte gelir
  loading?: boolean; // ekip detayı yeniden çekilirken
};

export default function TeamMembersCard({ team, loading }: Props) {
  const { members } = team;
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number>();
  const [searchInput, setSearchInput] = useState(''); // seçim kutusuna yazılan
  const [search, setSearch] = useState(''); // debounce'tan geçmiş, API'ye giden

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Eklenebilecek personeller: sadece aktifler; başka ekipte olanlar seçilemez görünür
  const { data: candidates, isFetching: isSearching } = useQuery({
    queryKey: ['workforce-users', 'options', search],
    queryFn: () =>
      listWorkforceUsers({ isActive: true, limit: 50, search: search || undefined }),
    enabled: team.isActive,
  });

  // Ekip üyeliği hem ekip detayını hem personel ekranlarını etkiler
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['teams'] });
    queryClient.invalidateQueries({ queryKey: ['workforce-users'] });
  };

  const addMutation = useMutation({
    mutationFn: (workforceUserId: number) => addTeamMember(team.id, workforceUserId),
    onSuccess: (user) => {
      message.success(`${user.firstname} ${user.lastname} ekibe eklendi`);
      setSelectedUserId(undefined);
      refresh();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (user: WorkforceUser) => removeTeamMember(team.id, user.id),
    onSuccess: (_, user) => {
      message.success(`${user.firstname} ${user.lastname} ekipten çıkarıldı`);
      refresh();
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
      title: 'Durum',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) =>
        isActive ? <Tag color="green">Aktif</Tag> : <Tag color="default">Pasif</Tag>,
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
            Ekipten Çıkar
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card title={`Ekip Personelleri (${members.length})`} style={{ marginTop: 24 }}>
      {team.isActive ? (
        <Space style={{ marginBottom: 16 }}>
          <Select<number>
            showSearch
            allowClear
            placeholder="Eklenecek personeli seçin (ada göre ara)"
            style={{ width: 360 }}
            value={selectedUserId}
            onChange={setSelectedUserId}
            onSearch={setSearchInput}
            filterOption={false} // arama sunucuda yapılıyor
            loading={isSearching}
            notFoundContent="Personel bulunamadı"
            options={candidates?.data.map((user) => ({
              value: user.id,
              label: user.team
                ? `${user.firstname} ${user.lastname} (${user.team.name} ekibinde)`
                : `${user.firstname} ${user.lastname} (${user.registrationNumber})`,
              disabled: user.teamId !== null,
            }))}
          />
          <Button
            type="primary"
            disabled={selectedUserId === undefined}
            loading={addMutation.isPending}
            onClick={() => selectedUserId !== undefined && addMutation.mutate(selectedUserId)}
          >
            Ekibe Ekle
          </Button>
        </Space>
      ) : (
        <Alert
          type="info"
          showIcon
          message="Ekip pasif olduğu için personel eklenemez."
          style={{ marginBottom: 16 }}
        />
      )}

      <Table<WorkforceUser>
        rowKey="id"
        columns={columns}
        dataSource={members}
        loading={loading}
        pagination={false}
        locale={{ emptyText: 'Bu ekipte henüz personel yok' }}
      />
    </Card>
  );
}
