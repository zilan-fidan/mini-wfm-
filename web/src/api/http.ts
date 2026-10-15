import axios, { AxiosError } from 'axios';
import { message } from 'antd';
import type { ApiErrorResponse } from '../types/error';

export const http = axios.create({
  baseURL: '/api',
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response) {
      // Sunucu yanıt verdi ama hata (400, 404, 409, 503...)
      const serverMessage = error.response.data?.message;
      const text = Array.isArray(serverMessage)
        ? serverMessage.join(', ')
        : serverMessage;
      message.error(text || 'Beklenmeyen bir hata oluştu');
    } else {
      // Yanıt hiç gelmedi: sunucuya ulaşılamıyor
      message.error('Sunucuya ulaşılamıyor');
    }
    return Promise.reject(error);
  },
);