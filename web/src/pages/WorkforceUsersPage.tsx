import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button, Flex, Input, Modal, Popconfirm, Select, Space, Switch, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router';
import { deleteWorkforceUser, listWorkforceUsers, updateWorkforceUser } from '../api/workforce-users.api';
import type { WorkforceUser } from '../types/workforce-user';
import WorkforceUserFormModal from '../components/WorkforceUserFormModal';
import { formatPhone } from '../utils/phone';

type StatusFilter = 'all' | 'active' | 'inactive';

const statusToIsActive = (status: StatusFilter): boolean | undefined => {
  if (status === 'active') return true;
  if (status === 'inactive') return false;
  return undefined; // 'all': filtre yok
};

const getColumns = (
  onEdit: (user: WorkforceUser) => void,
  onDelete: (user: WorkforceUser) => void,
  onToggle: (user: WorkforceUser, checked: boolean) => void,
  isToggling: (user: WorkforceUser) => boolean,
): ColumnsType<WorkforceUser> => [
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
    title: 'İşlemler',
    key: 'actions',
    render: (_, record) => (
      <Space>
        <Button size="small" onClick={() => onEdit(record)}>
          Düzenle
        </Button>
        <Popconfirm
          title="Personeli silmek istediğinize emin misiniz?"
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

export default function WorkforceUsersPage() {
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
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateWorkforceUser(id, { isActive }),
    onSuccess: () => {
      message.success('Personel durumu güncellendi');
      queryClient.invalidateQueries({ queryKey: ['workforce-users'] });
    },
  });

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Personeller
        </Typography.Title>
        <Button
          type="primary"
          onClick={() => {
            setEditingUser(null);
            setModalOpen(true);
          }}
        >
          Yeni Personel
        </Button>
      </Flex>

      <Space style={{ marginBottom: 16 }}>
        <Input
          allowClear
          placeholder="Personel adı ara..."
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

      <Table<WorkforceUser>
        rowKey="id"
        columns={getColumns(
          (user) => {
            setEditingUser(user);
            setModalOpen(true);
          },
          (user) => deleteMutation.mutate(user),
          (user, checked) => toggleMutation.mutate({ id: user.id, isActive: checked }),
          (user) => toggleMutation.isPending && toggleMutation.variables?.id === user.id,
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
      />

      <WorkforceUserFormModal
        open={modalOpen}
        workforceUser={editingUser}
        onClose={() => setModalOpen(false)}
        onCreated={() => setPage(1)}
      />
    </>
  );
}
