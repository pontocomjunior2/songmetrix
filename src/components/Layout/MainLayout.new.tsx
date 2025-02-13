import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';

interface MainLayoutProps {
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

export default function MainLayout({ children, currentView, onNavigate }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notifications = [
    { id: '1', message: 'Nativa FM - SP está online', date: '2024-02-13', read: false },
    { id: '2', message: 'Alpha FM - SP está online', date: '2024-02-13', read: false },
    { id: '3', message: 'Tropical FM - ES está online', date: '2024-02-13', read: false },
  ];

  const handleNavigate = (view: string) => {
    onNavigate(view);
    navigate(`/${view}`);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header 
        currentView={currentView}
        notifications={notifications}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
        showProfileMenu={showProfileMenu}
        setShowProfileMenu={setShowProfileMenu}
      />
      
      <Sidebar 
        currentView={currentView}
        onNavigate={handleNavigate}
      />

      <main className="ml-64 pt-16">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
