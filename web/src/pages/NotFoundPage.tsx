import { Button, Result } from 'antd';
import { useNavigate } from 'react-router';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="404"
      subTitle="Aradığınız sayfa bulunamadı."
      extra={
        <Button type="primary" onClick={() => navigate('/teams')}>
          Ekiplere dön
        </Button>
      }
    />
  );
}