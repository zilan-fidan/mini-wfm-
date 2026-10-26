import { Navigate, Route, Routes } from 'react-router';
import MainLayout from './layouts/MainLayout';
import NotFoundPage from './pages/NotFoundPage';
import TeamDetailPage from './pages/TeamDetailPage';
import TeamsPage from './pages/TeamsPage';
import WorkforceUserDetailPage from './pages/WorkforceUserDetailPage';
import WorkforceUsersPage from './pages/WorkforceUsersPage';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Navigate to="/teams" replace />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/:id" element={<TeamDetailPage />} />
        <Route path="/workforce-users" element={<WorkforceUsersPage />} />
        <Route path="/workforce-users/:id" element={<WorkforceUserDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}