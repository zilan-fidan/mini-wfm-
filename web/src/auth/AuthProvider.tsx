import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMe, login as loginRequest } from '../api/auth.api';
import type { AuthUser, LoginPayload } from '../types/auth';
import { AuthContext, type AuthContextValue } from './AuthContext';
import { tokenStorage, UNAUTHORIZED_EVENT } from './token';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  // Token varsa önce /auth/me ile doğrulanır; o sırada yönlendirme yapılmaz
  const [initializing, setInitializing] = useState(() => tokenStorage.get() !== null);

  useEffect(() => {
    if (!tokenStorage.get()) return;
    getMe()
      .then(setUser)
      .catch(() => setUser(null)) // 401 ise interceptor token'ı zaten sildi
      .finally(() => setInitializing(false));
  }, []);

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    queryClient.clear(); // önceki kullanıcının verisi önbellekte kalmasın
  }, [queryClient]);

  // Herhangi bir istekte 401 gelirse oturum kapatılır; RequireAuth girişe yönlendirir
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, clearSession);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, clearSession);
  }, [clearSession]);

  const login = useCallback(async (payload: LoginPayload) => {
    const { accessToken, user: loggedIn } = await loginRequest(payload);
    tokenStorage.set(accessToken);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      login,
      logout: clearSession,
      canManage: user?.role === 'ADMIN',
      canPlan: user?.role === 'ADMIN' || user?.role === 'PLANNER',
    }),
    [user, initializing, login, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
