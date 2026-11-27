import { useQuery } from '@tanstack/react-query';
import { Select, type SelectProps } from 'antd';
import { listTeams } from '../api/teams.api';

type Props = Omit<SelectProps<number>, 'options' | 'loading'> & {
  onlyActive?: boolean;
};

// Ekip seçimi; ekip sayısı az olduğu için ilk 100 kayıt yüklenip istemcide aranır
export default function TeamSelect({ onlyActive, ...rest }: Props) {
  const { data, isFetching } = useQuery({
    queryKey: ['teams', 'options', { onlyActive }],
    queryFn: () => listTeams({ limit: 100, isActive: onlyActive ? true : undefined }),
    staleTime: 60_000,
  });

  return (
    <Select<number>
      showSearch
      allowClear
      placeholder="Ekip seçin"
      optionFilterProp="label"
      loading={isFetching}
      options={data?.data.map((team) => ({
        value: team.id,
        label: team.isActive ? team.name : `${team.name} (pasif)`,
      }))}
      {...rest}
    />
  );
}
