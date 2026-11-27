const TOKEN_KEY = 'wfm.accessToken';

// Token localStorage'da tutulur; sayfa yenilense de oturum korunur
export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// 401 geldiğinde http katmanı bu olayı yayınlar, AuthProvider dinler
export const UNAUTHORIZED_EVENT = 'wfm:unauthorized';
