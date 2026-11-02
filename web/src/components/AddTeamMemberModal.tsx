import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, Select, Space, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { addTeamMember } from '../api/teams.api';
import { listWorkforceUsers } from '../api/workforce-users.api';
import type { Team } from '../types/team';
import type { WorkforceUser } from '../types/workforce-user';

type Props = {
  open: boolean;
  team: Team;
  onClose: () => void;
};

// Seçenekte personelin adı ve (varsa) ekibi; başka ekipte olan seçilemez
const renderOption = (user: WorkforceUser, team: Team) => (
  <Space>
    <span>
      {user.firstname} {user.lastname}
    </span>
    <Typography.Text type="secondary">{user.registrationNumber}</Typography.Text>
    {user.team &&
      (user.team.id === team.id ? (
        <Tag color="blue">Zaten bu ekipte</Tag>
      ) : (
        <Tag color="orange">{user.team.name} ekibinde</Tag>
      ))}
  </Space>
);

export default function AddTeamMemberModal({ open, team, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number>();
  const [searchInput, setSearchInput] = useState(''); // seçim kutusuna yazılan
  const [search, setSearch] = useState(''); // debounce'tan geçmiş, API'ye giden

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Kapanırken seçim ve arama temizlenir; tekrar açılınca boş başlar
  const handleClose = () => {
    setSelectedUserId(undefined);
    setSearchInput('');
    setSearch('');
    onClose();
  };

  // Sadece aktif personeller listelenir; pasif personel ekibe eklenemez
  const { data: candidates, isFetching } = useQuery({
    queryKey: ['workforce-users', 'options', search],
    queryFn: () =>
      listWorkforceUsers({ isActive: true, limit: 50, search: search || undefined }),
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: (workforceUserId: number) => addTeamMember(team.id, workforceUserId),
    onSuccess: (user) => {
      message.success(`${user.firstname} ${user.lastname} ekibe eklendi`);
      // Üyelik hem ekip detayını (üyeler tablosu) hem personel listesini etkiler
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-users'] });
      handleClose();
    },
  });

  return (
    <Modal
      open={open}
      title={`${team.name} ekibine üye ekle`}
      okText="Ekle"
      cancelText="İptal"
      okButtonProps={{ disabled: selectedUserId === undefined }}
      confirmLoading={addMutation.isPending}
      onCancel={handleClose}
      onOk={() => selectedUserId !== undefined && addMutation.mutate(selectedUserId)}
      destroyOnHidden
    >
      <Select<number>
        showSearch
        allowClear
        placeholder="Personel adı ile arayın"
        style={{ width: '100%' }}
        value={selectedUserId}
        onChange={setSelectedUserId}
        onSearch={setSearchInput}
        filterOption={false} // arama sunucuda yapılıyor
        loading={isFetching}
        notFoundContent={isFetching ? 'Aranıyor...' : 'Personel bulunamadı'}
        options={candidates?.data.map((user) => ({
          value: user.id,
          label: renderOption(user, team),
          disabled: user.team !== null && user.team !== undefined,
        }))}
      />
    </Modal>
  );
}
