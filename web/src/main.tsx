import '@ant-design/v5-patch-for-react-19'; // antd statik metotları (Modal.success, message) React 19'da çalışsın
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import AuthProvider from './auth/AuthProvider';
import './index.css';

dayjs.locale('tr');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
