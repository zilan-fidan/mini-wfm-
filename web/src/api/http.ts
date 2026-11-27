import axios, { AxiosError } from 'axios';
import { message } from 'antd';
import { tokenStorage, UNAUTHORIZED_EVENT } from '../auth/token';
import type { ApiErrorResponse } from '../types/error';

export const http = axios.create({
  baseURL: '/api',
});

// Giriş isteğinin hatasını login formu kendisi gösterir
const isLoginRequest = (url?: string) => url === '/auth/login';

// Her isteğe varsa token eklenir
http.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const extractErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    if (!error.response) return 'Sunucuya ulaşılamıyor';
    const serverMessage = error.response.data?.message;
    const text = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
    return text || 'Beklenmeyen bir hata oluştu';
  }
  return 'Beklenmeyen bir hata oluştu';
};

// 409 gibi hatalarda backend'in döndüğü ayrıntılar (yoksa boş dizi)
export const extractErrorDetails = (error: unknown): unknown[] => {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const details = error.response?.data?.details;
    return Array.isArray(details) ? details : [];
  }
  return [];
};

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status;
    const loginRequest = isLoginRequest(error.config?.url);

    if (status === 401 && !loginRequest) {
      // Token geçersiz/süresi dolmuş: sil ve oturumu kapat
      const hadToken = tokenStorage.get() !== null;
      tokenStorage.clear();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      if (hadToken) {
        message.warning({ content: 'Oturumunuz sona erdi, lütfen tekrar giriş yapın', key: 'session-expired' });
      }
    } else if (status === 403) {
      message.error({ content: 'Bu işlem için yetkiniz yok', key: 'forbidden' });
    } else if (!loginRequest) {
      // Diğer hatalar (400, 404, 409, 503...) veya sunucuya ulaşılamıyor
      message.error(extractErrorMessage(error));
    }
    return Promise.reject(error);
  },
);
