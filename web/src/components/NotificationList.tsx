import { ClockCircleOutlined, NotificationOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Empty, List, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { ReactNode } from 'react';
import { listNotifications } from '../api/notifications.api';
import type { NotificationType } from '../types/notification';
import { formatDateTime } from '../utils/date';

dayjs.extend(relativeTime);

const TYPE_META: Record<NotificationType, { label: string; color: string; bg: string; icon: ReactNode }> = {
  WORK_ORDER_ASSIGNED: { label: 'Atama', color: 'purple', bg: '#ECEBFA', icon: <NotificationOutlined style={{ color: 'var(--lilac-accent)' }} /> },
  WORK_ORDER_OVERDUE: { label: 'Gecikme', color: 'red', bg: '#FFECEC', icon: <ClockCircleOutlined style={{ color: '#E5484D' }} /> },
};

export default function NotificationList({ workforceUserId }: { workforceUserId: number }) {
  const { data, isFetching } = useQuery({
    queryKey: ['notifications', workforceUserId],
    queryFn: () => listNotifications(workforceUserId),
  });

  return (
    <List
      loading={isFetching}
      dataSource={data}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Bildirim yok" /> }}
      renderItem={(n) => {
        const meta = TYPE_META[n.type] ?? TYPE_META.WORK_ORDER_ASSIGNED;
        return (
          <List.Item>
            <List.Item.Meta
              avatar={<Avatar style={{ background: meta.bg }} icon={meta.icon} />}
              title={
                <>
                  {n.title}{' '}
                  <Tag color={meta.color} bordered={false} style={{ marginLeft: 4 }}>
                    {meta.label}
                  </Tag>
                </>
              }
              description={
                <>
                  <div style={{ color: '#374151' }}>{n.body}</div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }} title={formatDateTime(n.createdAt)}>
                    {dayjs(n.createdAt).fromNow()}
                  </Typography.Text>
                </>
              }
            />
          </List.Item>
        );
      }}
    />
  );
}
