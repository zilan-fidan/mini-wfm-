import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Flex, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { deleteWorkforceUser, listWorkforceUsers, updateWorkforceUser } from '../api/workforce-users.api';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusTag from '../components/StatusTag';
import WorkforceUserFormModal from '../components/WorkforceUserFormModal';
import type { WorkforceUser } from '../types/workforce-user';
import { formatPhone } from '../utils/phone';

type StatusFilter = 'all' | 'active' | 'inactive';

const statusToIsActive = (status: StatusFilter): boolean | undefined => {
  if (status === 'active') return true;
  if (status === 'inactive') return false;
  return undefined; // 'all': filtre yok
};

type ColumnHandlers = {
  canManage: boolean; // false ise düzenle/sil/aktif-pasif gösterilmez (F8)
  onEdit: (user: WorkforceUser) => void;
  onDelete: (user: WorkforceUser) => void;
  onToggle: (user: WorkforceUser, checked: boolean) => void;
  isToggling: (user: WorkforceUser) => boolean;
};

const initials = (user: WorkforceUser) =>
  `${user.firstname.charAt(0)}${user.lastname.charAt(0)}`.toLocaleUpperCase('tr-TR');

const getColumns = ({ canManage, onEdit, onDelete, onToggle, isToggling }: ColumnHandlers): ColumnsType<WorkforceUser> => [
  {
    title: 'Ad Soyad',
    key: 'fullName',
    render: (_, record) => (
      <Flex align="center" gap={10}>
        <Avatar size="small" style={{ background: '#ECEBFA', color: 'var(--lilac-accent)', fontWeight: 700, fontSize: 11 }}>
          {initials(record)}
        </Avatar>
        <Link to={`/workforce-users/${record.id}`} style={{ fontWeight: 600 }}>
          {record.firstname} {record.lastname}
        </Link>
      </Flex>
    ),
  },
  {
    title: 'Sicil No',
    dataIndex: 'registrationNumber',
    key: 'registrationNumber',
    width: 130,
  },
  {
    title: 'Telefon',
    dataIndex: 'phone',
    key: 'phone',
    width: 150,
    render: (phone: string | null) => formatPhone(phone),
  },
  {
    title: 'Ekip',
    key: 'team',
    render: (_, record) =>
      record.team ? (
        <Link to={`/teams/${record.team.id}`}>
          <Tag color="geekblue" bordered={false} style={{ cursor: 'pointer' }}>
            {record.team.name}
          </Tag>
        </Link>
      ) : (
        '-'
      ),
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
  ...(canManage
    ? [
        {
          title: 'İşlemler',
          key: 'actions',
          width: 110,
          render: (_: unknown, record: WorkforceUser) => (
            <Space>
              <Tooltip title="Düzenle">
                <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record)} />
              </Tooltip>
              <Popconfirm
                title="Personeli silmek istediğinize emin misiniz?"
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

export default function WorkforceUsersPage() {
  const { canManage } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState(''); // kutudaki anlık yazı
  const [search, setSearch] = useState(''); // debounce'tan geçmiş, API'ye giden
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<WorkforceUser | null>(null);

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
    queryKey: ['workforce-users', { page, pageSize, isActive, search }],
    queryFn: () =>
      listWorkforceUsers({
        page,
        limit: pageSize,
        isActive,
        search: search || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (user: WorkforceUser) => deleteWorkforceUser(user.id),
    onSuccess: (_, user) => {
      Modal.success({
        title: 'Personel silindi',
        content: `${user.firstname} ${user.lastname} kaydı silindi.`,
        okText: 'Tamam',
      });
      // Sayfadaki son kayıt silindiyse bir önceki sayfaya dön
      if ((data?.data.length ?? 0) === 1 && page > 1) {
        setPage(page - 1);
      }
      queryClient.invalidateQueries({ queryKey: ['workforce-users'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateWorkforceUser(id, { isActive }),
    onSuccess: () => {
      message.success('Personel durumu güncellendi');
      queryClient.invalidateQueries({ queryKey: ['workforce-users'] });
    },
  });

  return (
    <>
      <PageHeader
        title="Personeller"
        subtitle={data ? `Toplam ${data.total} personel` : 'Personelleri görüntüleyin ve yönetin'}
        extra={
          canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingUser(null);
                setModalOpen(true);
              }}
            >
              Yeni Personel
            </Button>
          )
        }
      />

      <Card className="page-card">
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#9aa3b5' }} />}
            placeholder="Personel adı ara..."
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

        <Table<WorkforceUser>
          rowKey="id"
          scroll={{ x: 820 }}
          columns={getColumns({
            canManage,
            onEdit: (user) => {
              setEditingUser(user);
              setModalOpen(true);
            },
            onDelete: (user) => deleteMutation.mutate(user),
            onToggle: (user, checked) => toggleMutation.mutate({ id: user.id, isActive: checked }),
            isToggling: (user) => toggleMutation.isPending && toggleMutation.variables?.id === user.id,
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
        <WorkforceUserFormModal
          open={modalOpen}
          workforceUser={editingUser}
          onClose={() => setModalOpen(false)}
          onCreated={() => setPage(1)}
        />
      )}
    </>
  );
}
