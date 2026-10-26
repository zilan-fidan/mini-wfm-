import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState} from 'react';
import { Button, Flex, Input, Popconfirm, Select, Space,  Switch,Table, Typography, message  } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { Link } from 'react-router';
import { deleteTeam, listTeams,updateTeam} from '../api/teams.api';
import type { Team } from '../types/team';
import TeamFormModal from '../components/TeamFormModal';

type StatusFilter = 'all' | 'active' | 'inactive';

const statusToIsActive = (status: StatusFilter): boolean | undefined => {
  if (status === 'active') return true;
  if (status === 'inactive') return false;
  return undefined; // 'all': filtre yok
};

const getColumns = (onEdit: (team: Team) => void,onDelete: (team: Team) => void,onToggle: (team: Team, checked: boolean) => void,
  isToggling: (team: Team) => boolean,): ColumnsType<Team> => [
  {
    title: 'Ekip Adı',
    dataIndex: 'name',
    key: 'name',
    render: (name: string, record) => <Link to={`/teams/${record.id}`}>{name}</Link>,
  },
  {
    title: 'Açıklama',
    dataIndex: 'description',
    key: 'description',
    render: (description: string | null) => description || '-',
  },
  {
  title: 'Durum',
  dataIndex: 'isActive',
  key: 'isActive',
  render: (isActive: boolean, record) => (
    <Switch
      checked={isActive}
      checkedChildren="Aktif"
      unCheckedChildren="Pasif"
      loading={isToggling(record)}
      onChange={(checked) => onToggle(record, checked)}
    />
  ),
},
  {
    title: 'Oluşturulma',
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (createdAt: string) => dayjs(createdAt).format('DD.MM.YYYY HH:mm'),
  },
  {
    title: 'İşlemler',
    key: 'actions',
    render: (_, record) => (
      <Space>
        <Button size="small" onClick={() => onEdit(record)}>
          Düzenle
        </Button>
       <Popconfirm
  title="Ekibi silmek istediğinize emin misiniz?"
  okText="Evet, Sil"
  cancelText="Vazgeç"
  okButtonProps={{ danger: true }}
  onConfirm={() => onDelete(record)}
>
  <Button size="small" danger>
    Sil
  </Button>
</Popconfirm>
      </Space>
    ),
  },
];


 export default function TeamsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState(''); // kutudaki anlık yazı
  const [search, setSearch] = useState(''); // debounce'tan geçmiş, API'ye giden
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // searchInput değişince 400 ms bekle, sessizlik olursa search'i güncelle
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); // arama gerçekten değişti: 1. sayfaya dön
    }, 700);

    return () => clearTimeout(timer); // yeni tuş gelirse eski kum saatini iptal et
  }, [searchInput]);

  const isActive = statusToIsActive(status);

  const { data, isFetching } = useQuery({
    queryKey: ['teams', { page, pageSize, isActive, search }],
    queryFn: () =>
      listTeams({
        page,
        limit: pageSize,
        isActive,
        search: search || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const queryClient = useQueryClient();

const deleteMutation = useMutation({
  mutationFn: (team: Team) => deleteTeam(team.id),
  onSuccess: () => {
  console.log('silme başarılı');
  message.success('Ekip silindi');
    // Sayfadaki son kayıt silindiyse bir önceki sayfaya dön
    if ((data?.data.length ?? 0) === 1 && page > 1) {
      setPage(page - 1);
    }
    queryClient.invalidateQueries({ queryKey: ['teams'] });
  },
});
const toggleMutation = useMutation({
  mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
    updateTeam(id, { isActive }),
  onSuccess: () => {
    message.success('Ekip durumu güncellendi');
    queryClient.invalidateQueries({ queryKey: ['teams'] });
  },
});

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
  <Typography.Title level={2} style={{ margin: 0 }}>
    Ekipler
  </Typography.Title>
  <Button
  type="primary"
  onClick={() => {
    setEditingTeam(null);
    setModalOpen(true);
  }}
>
  Yeni Ekip
</Button>
</Flex>

      <Space style={{ marginBottom: 16 }}>
        <Input
          allowClear
          placeholder="Ekip adı ara..."
          style={{ width: 240 }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select<StatusFilter>
          value={status}
          style={{ width: 140 }}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'active', label: 'Aktif' },
            { value: 'inactive', label: 'Pasif' },
          ]}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      </Space>

      <Table<Team>
        rowKey="id"
        columns={getColumns(
  (team) => {
    setEditingTeam(team);
    setModalOpen(true);
  },
  (team) => deleteMutation.mutate(team),
  (team, checked) => toggleMutation.mutate({ id: team.id, isActive: checked }),
  (team) => toggleMutation.isPending && toggleMutation.variables?.id === team.id,
)}
        dataSource={data?.data}
        loading={isFetching}
        locale={{ emptyText: 'Kayıt bulunamadı' }}
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
      /><TeamFormModal
  open={modalOpen}
  team={editingTeam}
  onClose={() => setModalOpen(false)}
  onCreated={() => setPage(1)}
/>
    </>
  );
}