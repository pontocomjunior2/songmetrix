import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import MainLayout from './components/Layout/MainLayout.new';
import Dashboard from './components/Dashboard/Dashboard.new';
import RealTime from './components/RealTime';
import Ranking from './components/Ranking';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import PaymentSuccess from './components/Payment/PaymentSuccess';
import PaymentCanceled from './components/Payment/PaymentCanceled';

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determina a view atual baseada na URL
  const getCurrentView = () => {
    const path = location.pathname.split('/')[1] || 'dashboard';
    return path;
  };

  // Função para navegação
  const handleNavigate = (view: string) => {
    navigate(`/${view}`);
  };

  return (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/canceled" element={<PaymentCanceled />} />
      
      {/* Rotas protegidas */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout currentView={getCurrentView()} onNavigate={handleNavigate}>
              <Routes>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="realtime" element={<RealTime />} />
                <Route path="ranking" element={<Ranking />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </MainLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
