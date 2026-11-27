import { useQuery } from '@tanstack/react-query';
import { Select, type SelectProps } from 'antd';
import { useEffect, useState } from 'react';
import { listWorkforceUsers } from '../api/workforce-users.api';

type Props = Omit<SelectProps<number>, 'options' | 'loading' | 'onSearch' | 'filterOption'> & {
  onlyActive?: boolean;
  // Düzenlemede seçili personel arama sonuçlarında yoksa adı yine görünsün
  initialOption?: { value: number; label: string };
};

// Personel seçimi; arama sunucuda yapılır
export default function WorkforceUserSelect({ onlyActive, initialOption, ...rest }: Props) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isFetching } = useQuery({
    queryKey: ['workforce-users', 'options', { search, onlyActive }],
    queryFn: () =>
      listWorkforceUsers({ limit: 50, search: search || undefined, isActive: onlyActive ? true : undefined }),
  });

  return (
    <Select<number>
      showSearch
      allowClear
      placeholder="Personel arayın"
      filterOption={false}
      onSearch={setSearchInput}
      loading={isFetching}
      notFoundContent={isFetching ? 'Aranıyor...' : 'Personel bulunamadı'}
      options={[
        ...(initialOption && !data?.data.some((u) => u.id === initialOption.value) ? [initialOption] : []),
        ...(data?.data.map((user) => ({
          value: user.id,
          label: `${user.firstname} ${user.lastname} · ${user.registrationNumber}`,
        })) ?? []),
      ]}
      {...rest}
    />
  );
}
