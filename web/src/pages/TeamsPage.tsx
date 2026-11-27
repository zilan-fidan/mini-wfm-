import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Popconfirm, Select, Space, Switch, Table, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { deleteTeam, listTeams, updateTeam } from '../api/teams.api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusTag from '../components/StatusTag';
import TeamFormModal from '../components/TeamFormModal';
import type { Team } from '../types/team';

type StatusFilter = 'all' | 'active' | 'inactive';

const statusToIsActive = (status: StatusFilter): boolean | undefined => {
  if (status === 'active') return true;
  if (status === 'inactive') return false;
  return undefined; // 'all': filtre yok
};

type ColumnHandlers = {
  canManage: boolean; // false ise düzenle/sil/aktif-pasif gösterilmez (F8)
  onEdit: (team: Team) => void;
  onDelete: (team: Team) => void;
  onToggle: (team: Team, checked: boolean) => void;
  isToggling: (team: Team) => boolean;
};

const getColumns = ({ canManage, onEdit, onDelete, onToggle, isToggling }: ColumnHandlers): ColumnsType<Team> => [
  {
    title: 'Ekip Adı',
    dataIndex: 'name',
    key: 'name',
    render: (name: string, record) => (
      <Link to={`/teams/${record.id}`} style={{ fontWeight: 600 }}>
        {name}
      </Link>
    ),
  },
  {
    title: 'Açıklama',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
    render: (description: string | null) => description || '-',
  },
  {
    title: 'Durum',
    dataIndex: 'isActive',
    key: 'isActive',
    width: 120,
    render: (isActive: boolean, record) =>
      canManage ? (
        <Switch
          checked={isActive}
          checkedChildren="Aktif"
          unCheckedChildren="Pasif"
          loading={isToggling(record)}
          onChange={(checked) => onToggle(record, checked)}
        />
      ) : (
        <StatusTag isActive={isActive} />
      ),
  },
  {
    title: 'Oluşturulma',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 170,
    render: (createdAt: string) => dayjs(createdAt).format('DD.MM.YYYY HH:mm'),
  },
  ...(canManage
    ? [
        {
          title: 'İşlemler',
          key: 'actions',
          width: 110,
          render: (_: unknown, record: Team) => (
            <Space>
              <Tooltip title="Düzenle">
                <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record)} />
              </Tooltip>
              <Popconfirm
                title="Ekibi silmek istediğinize emin misiniz?"
                okText="Evet, Sil"
                cancelText="Vazgeç"
                okButtonProps={{ danger: true }}
                onConfirm={() => onDelete(record)}
              >
                <Tooltip title="Sil">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </Space>
          ),
        },
      ]
    : []),
];

export default function TeamsPage() {
  const { canManage } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState(''); // kutudaki anlık yazı
  const [search, setSearch] = useState(''); // debounce'tan geçmiş, API'ye giden
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // searchInput değişince bekle, sessizlik olursa search'i güncelle
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); // arama gerçekten değişti: 1. sayfaya dön
    }, 700);

    return () => clearTimeout(timer); // yeni tuş gelirse eski zamanlayıcıyı iptal et
  }, [searchInput]);

  const isActive = statusToIsActive(status);
  const queryClient = useQueryClient();

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

  const deleteMutation = useMutation({
    mutationFn: (team: Team) => deleteTeam(team.id),
    onSuccess: () => {
      message.success('Ekip silindi');
      // Sayfadaki son kayıt silindiyse bir önceki sayfaya dön
      if ((data?.data.length ?? 0) === 1 && page > 1) {
        setPage(page - 1);
      }
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateTeam(id, { isActive }),
    onSuccess: () => {
      message.success('Ekip durumu güncellendi');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  return (
    <>
      <PageHeader
        title="Ekipler"
        subtitle={data ? `Toplam ${data.total} ekip` : 'Ekipleri görüntüleyin ve yönetin'}
        extra={
          canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingTeam(null);
                setModalOpen(true);
              }}
            >
              Yeni Ekip
            </Button>
          )
        }
      />

      <Card className="page-card">
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#9aa3b5' }} />}
            placeholder="Ekip adı ara..."
            style={{ width: 260 }}
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
          scroll={{ x: 720 }}
          columns={getColumns({
            canManage,
            onEdit: (team) => {
              setEditingTeam(team);
              setModalOpen(true);
            },
            onDelete: (team) => deleteMutation.mutate(team),
            onToggle: (team, checked) => toggleMutation.mutate({ id: team.id, isActive: checked }),
            isToggling: (team) => toggleMutation.isPending && toggleMutation.variables?.id === team.id,
          })}
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
        />
      </Card>

      {canManage && (
        <TeamFormModal
          open={modalOpen}
          team={editingTeam}
          onClose={() => setModalOpen(false)}
          onCreated={() => setPage(1)}
        />
      )}
    </>
  );
}
