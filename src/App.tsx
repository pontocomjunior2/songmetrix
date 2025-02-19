import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AdminRoute from './components/Auth/AdminRoute';
import FirstAccessRoute from './components/Auth/FirstAccessRoute';
import PendingApproval from './components/Auth/PendingApproval';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard/index';
import Ranking from './components/Ranking';
import RealTime from './components/RealTime';
import Radios from './components/Radios';
import UserList from './components/Admin/UserList';
import RadioAbbreviations from './components/Admin/RadioAbbreviations';
import PaymentSuccess from './components/Payment/PaymentSuccess';
import PaymentCanceled from './components/Payment/PaymentCanceled';
import Relatorios from './components/Relatorios';

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
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/canceled" element={<PaymentCanceled />} />
          <Route path="/first-access" element={<FirstAccessRoute />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout currentView={currentView} onNavigate={handleNavigate} />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="ranking" element={<Ranking />} />
            <Route path="realtime" element={<RealTime />} />
            <Route path="radios" element={<Radios />} />
            <Route path="relatorios" element={<Relatorios />} />
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
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
