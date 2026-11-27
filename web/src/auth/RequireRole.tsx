import { Result } from 'antd';
import { Outlet } from 'react-router';
import type { Role } from '../types/auth';
import { useAuth } from './AuthContext';

// Rolü yetmeyen kullanıcı sayfa yerine 403 görür (menüde de gizlidir)
export default function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Result status="403" title="Yetkiniz yok" subTitle="Bu sayfayı görüntülemek için yetkiniz bulunmuyor." />;
  }
  return <Outlet />;
}
