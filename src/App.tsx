import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import RequestPasswordReset from './components/Auth/RequestPasswordReset';
import ResetPassword from './components/Auth/ResetPassword';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AdminRoute from './components/Auth/AdminRoute';
import FirstAccessRoute from './components/Auth/FirstAccessRoute';
import PendingApproval from './components/Auth/PendingApproval';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './components/Dashboard';
import Ranking from './components/Ranking';
import RealTime from './components/RealTime';
import Radios from './components/Radios';
import UserList from './components/Admin/UserList';
import RadioAbbreviations from './components/Admin/RadioAbbreviations';
import StreamsManager from './components/Admin/StreamsManager';
import RelayStreamsManager from './components/Admin/RelayStreamsManager';
import RadioSuggestions from './components/Admin/RadioSuggestions';
import EmailManager from './components/Admin/EmailManager';
import NotificationsPage from './pages/Admin/NotificationsPage';
import PaymentSuccess from './components/Payment/PaymentSuccess';
import PaymentCanceled from './components/Payment/PaymentCanceled';
import Relatorios from './components/Relatorios';
import Plans from './components/Plans';
import Spotify from './components/Spotify';

// Componente para redirecionar após confirmação de email
// Deve ser usado dentro do Router
function RedirectHandler() {
  const location = useLocation();
  
  useEffect(() => {
    // Verificar se estamos na raiz e se a URL tem parâmetros de confirmação de email
    if (location.pathname === '/' && 
        (location.search.includes('type=email_confirmation') || 
         location.search.includes('type=signup') ||
         location.hash.includes('type=email_confirmation') ||
         location.hash.includes('type=signup'))) {
      // Redirecionar para página de login
      window.location.href = '/login';
    }
  }, [location]);
  
  return null;
}

// Interface para as props do RootRoute
interface RootRouteProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

// Componente específico para raiz que verifica se precisa redirecionar
function RootRoute({ currentView, onNavigate }: RootRouteProps) {
  return (
    <>
      <RedirectHandler />
      <ProtectedRoute>
        <MainLayout currentView={currentView} onNavigate={onNavigate} />
      </ProtectedRoute>
    </>
  );
}

function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  const handleNavigate = (view: string) => {
    setCurrentView(view);
  };

  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<RequestPasswordReset />} />
          <Route path="/update-password" element={<ResetPassword />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/canceled" element={<PaymentCanceled />} />
          <Route path="/first-access" element={<FirstAccessRoute />} />
          <Route path="/plans" element={<Plans />} />
          
          {/* Rota raiz com verificação de redirecionamento */}
          <Route path="/" element={<RootRoute currentView={currentView} onNavigate={handleNavigate} />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="ranking" element={<Ranking />} />
            <Route path="realtime" element={<RealTime />} />
            <Route path="radios" element={<Radios />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="spotify" element={<Spotify />} />
            <Route path="admin/users" element={
              <AdminRoute>
                <UserList />
              </AdminRoute>
            } />
            <Route path="admin/abbreviations" element={
              <AdminRoute>
                <RadioAbbreviations />
              </AdminRoute>
            } />
            <Route path="admin/streams" element={
              <AdminRoute>
                <StreamsManager />
              </AdminRoute>
            } />
            <Route path="admin/relay-streams" element={
              <AdminRoute>
                <RelayStreamsManager />
              </AdminRoute>
            } />
            <Route path="admin/suggestions" element={
              <AdminRoute>
                <RadioSuggestions />
              </AdminRoute>
            } />
            <Route path="admin/emails" element={
              <AdminRoute>
                <EmailManager />
              </AdminRoute>
            } />
            <Route path="admin/notifications" element={
              <AdminRoute>
                <NotificationsPage />
              </AdminRoute>
            } />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
