import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
// import { ThemeProvider } from '@/hooks/useTheme'; // ThemeProvider parece não ser necessário/existente
import Login from '@/components/Auth/Login';
import Register from '@/components/Auth/Register';
import RequestPasswordReset from '@/components/Auth/RequestPasswordReset';
import ResetPassword from '@/components/Auth/ResetPassword';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import AdminRoute from '@/components/Auth/AdminRoute';
import FirstAccessRoute from '@/components/Auth/FirstAccessRoute';
import PendingApproval from '@/components/Auth/PendingApproval';
import MainLayout from '@/components/Layout/MainLayout';
import Loading from '@/components/Common/Loading';
import Dashboard from '@/components/Dashboard';
import Ranking from '@/components/Ranking';
import RealTime from '@/components/RealTime';
import Radios from '@/components/Radios';
import Relatorios from '@/components/Relatorios';
import Spotify from '@/components/Spotify';
import Plans from '@/components/Plans/index';
import UserList from '@/components/Admin/UserList';
import RadioAbbreviations from '@/components/Admin/RadioAbbreviations';
import StreamsManager from '@/components/Admin/StreamsManager';
import RelayStreamsManager from '@/components/Admin/RelayStreamsManager';
import RadioSuggestions from '@/components/Admin/RadioSuggestions';
import EmailManager from '@/components/Admin/EmailManager';
import NotificationsPage from '@/pages/Admin/NotificationsPage';
import PaymentSuccess from '@/components/Payment/PaymentSuccess';
import PaymentCanceled from '@/components/Payment/PaymentCanceled';

const MeuPlanoPage = lazy(() => import('@/pages/MeuPlanoPage'));

const RootRoute = () => {
  return (
    <ProtectedRoute>
      <MainLayout />
    </ProtectedRoute>
  );
};

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<RequestPasswordReset />} />
          <Route path="/update-password" element={<ResetPassword />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/canceled" element={<PaymentCanceled />} />
          <Route path="/first-access" element={<FirstAccessRoute />} />
          
          {/* Rotas Protegidas aninhadas */}
          <Route path="/" element={<RootRoute />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="ranking" element={<Ranking />} />
            <Route path="realtime" element={<RealTime />} />
            <Route path="radios" element={<Radios />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="spotify" element={<Spotify />} />
            <Route path="plans" element={<Plans />} />
            <Route path="meu-plano" element={<MeuPlanoPage />} />
            <Route path="admin/users" element={<AdminRoute><UserList /></AdminRoute>} />
            <Route path="admin/abbreviations" element={<AdminRoute><RadioAbbreviations /></AdminRoute>} />
            <Route path="admin/streams" element={<AdminRoute><StreamsManager /></AdminRoute>} />
            <Route path="admin/relay-streams" element={<AdminRoute><RelayStreamsManager /></AdminRoute>} />
            <Route path="admin/suggestions" element={<AdminRoute><RadioSuggestions /></AdminRoute>} />
            <Route path="admin/emails" element={<AdminRoute><EmailManager /></AdminRoute>} />
            <Route path="admin/notifications" element={<AdminRoute><NotificationsPage /></AdminRoute>} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
