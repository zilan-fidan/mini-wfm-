import { Flex, Typography } from 'antd';
import type { ReactNode } from 'react';

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
};

export default function PageHeader({ title, subtitle, extra }: Props) {
  return (
    <Flex justify="space-between" align="center" wrap gap={12} className="page-header">
      <div>
        <Typography.Title level={2}>{title}</Typography.Title>
        {subtitle && <Typography.Text className="page-header__subtitle">{subtitle}</Typography.Text>}
      </div>
      {extra}
    </Flex>
  );
}
