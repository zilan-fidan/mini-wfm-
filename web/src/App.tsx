import { ConfigProvider } from 'antd';
import trTR from 'antd/locale/tr_TR';
import { useLayoutEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { GuestOnly, RequireAuth } from './auth/RequireAuth';
import RequireRole from './auth/RequireRole';
import MainLayout from './layouts/MainLayout';
import AccountsPage from './pages/AccountsPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import NotificationsPage from './pages/NotificationsPage';
import ReportsPage from './pages/ReportsPage';
import ShiftsPage from './pages/ShiftsPage';
import TeamDetailPage from './pages/TeamDetailPage';
import TeamsPage from './pages/TeamsPage';
import WorkOrderDetailPage from './pages/WorkOrderDetailPage';
import WorkOrdersPage from './pages/WorkOrdersPage';
import WorkforceUserDetailPage from './pages/WorkforceUserDetailPage';
import WorkforceUsersPage from './pages/WorkforceUsersPage';

import { appTheme, invertedAppTheme } from './theme/theme';

const COLOR_MODE_KEY = 'mini-wfm:color-mode';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem(COLOR_MODE_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  useLayoutEffect(() => {
    document.documentElement.dataset.colorMode = darkMode ? 'dark' : 'light';
    try {
      localStorage.setItem(COLOR_MODE_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // Tema, tarayıcıda depolama kapalıyken de geçerli oturumda çalışır.
    }
  }, [darkMode]);

  return (
    <ConfigProvider locale={trTR} theme={darkMode ? invertedAppTheme : appTheme}>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Bilinmeyen adresler (404) dahil her şey giriş gerektirir */}
        <Route element={<RequireAuth />}>
          <Route element={<MainLayout darkMode={darkMode} onDarkModeChange={setDarkMode} />}>
            <Route path="/" element={<Navigate to="/work-orders" replace />} />
            <Route path="/work-orders" element={<WorkOrdersPage />} />
            <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
            <Route path="/shifts" element={<ShiftsPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:id" element={<TeamDetailPage />} />
            <Route path="/workforce-users" element={<WorkforceUsersPage />} />
            <Route path="/workforce-users/:id" element={<WorkforceUserDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route element={<RequireRole roles={['ADMIN']} />}>
              <Route path="/accounts" element={<AccountsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </ConfigProvider>
  );
}
