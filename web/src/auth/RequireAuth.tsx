import { Flex, Spin } from 'antd';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext';

export type RedirectState = { from?: string };

// Giriş yapılmamışsa gidilmek istenen adresi hatırlayarak /login'e yönlendirir
export function RequireAuth() {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from } satisfies RedirectState} />;
  }

  return <Outlet />;
}

// Giriş yapmış kullanıcı /login'de kalmaz: gitmek istediği adrese (yoksa ana sayfaya) döner.
// Girişten sonraki yönlendirme de buradan yapılır.
export function GuestOnly() {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return null;
  if (!user) return <Outlet />;
  const from = (location.state as RedirectState | null)?.from;
  // Sadece uygulama içi adresler kabul edilir
  const target = from && from.startsWith('/') && !from.startsWith('/login') ? from : '/';
  return <Navigate to={target} replace />;
}
