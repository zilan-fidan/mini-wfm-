import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState} from 'react';
import { Button, Flex , Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { Link } from 'react-router';
import { listTeams } from '../api/teams.api';
import type { Team } from '../types/team';

type StatusFilter = 'all' | 'active' | 'inactive';

const statusToIsActive = (status: StatusFilter): boolean | undefined => {
  if (status === 'active') return true;
  if (status === 'inactive') return false;
  return undefined; // 'all': filtre yok
};

const columns: ColumnsType<Team> = [
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
    render: (isActive: boolean) =>
      isActive ? <Tag color="green">Aktif</Tag> : <Tag color="default">Pasif</Tag>,
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
    render: () => (
      <Space>
        <Button size="small">Düzenle</Button>
        <Button size="small" danger>
          Sil
        </Button>
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

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
  <Typography.Title level={2} style={{ margin: 0 }}>
    Ekipler
  </Typography.Title>
  <Button type="primary">Yeni Ekip</Button>
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
        columns={columns}
        dataSource={data?.data}
        loading={isFetching}
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
    </>
  );
}