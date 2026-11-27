import { Card, Empty, Typography } from 'antd';
import { useSearchParams } from 'react-router';
import NotificationList from '../components/NotificationList';
import PageHeader from '../components/PageHeader';
import WorkforceUserSelect from '../components/WorkforceUserSelect';

// Bildirimler personel bazındadır; seçilen personel adreste tutulur (?workforceUserId=)
export default function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const selected = Number(params.get('workforceUserId')) || undefined;

  return (
    <>
      <PageHeader title="Bildirimler" subtitle="Personellere gönderilen iş emri atama ve gecikme bildirimleri" />
      <Card className="page-card">
        <WorkforceUserSelect
          value={selected}
          onChange={(id) => setParams(id ? { workforceUserId: String(id) } : {})}
          placeholder="Bildirimlerini görmek için personel seçin"
          style={{ width: 360, maxWidth: '100%', marginBottom: 16 }}
        />
        {selected ? (
          <NotificationList workforceUserId={selected} />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Typography.Text type="secondary">Personel seçilmedi</Typography.Text>}
          />
        )}
      </Card>
    </>
  );
}
