import { createContext, useContext } from 'react';
import type { AuthUser, LoginPayload, Role } from '../types/auth';

export type AuthContextValue = {
  user: AuthUser | null;
  initializing: boolean; // açılışta token doğrulanırken true
  login: (payload: LoginPayload) => Promise<AuthUser>;
  logout: () => void;
  // Ekip/personel/hesap üzerinde yazma işlemleri backend'de sadece ADMIN'e açık
  canManage: boolean;
  // Vardiya ve iş emri işlemleri ADMIN ve PLANNER'a açık
  canPlan: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Yönetici',
  PLANNER: 'Planlamacı',
  VIEWER: 'Görüntüleyici',
};

export const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'gold',
  PLANNER: 'geekblue',
  VIEWER: 'cyan',
};
