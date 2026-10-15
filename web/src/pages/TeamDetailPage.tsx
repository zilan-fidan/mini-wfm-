import { Typography } from 'antd';
import { useParams } from 'react-router';

export default function TeamDetailPage() {
  const { id } = useParams();

  return <Typography.Title level={2}>Ekip Detayı (#{id})</Typography.Title>;
}