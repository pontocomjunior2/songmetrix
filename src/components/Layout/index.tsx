import React, { useState, useEffect } from 'react';
import { Bell, ChevronDown, HelpCircle, LogOut, Moon, Settings, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import UserAvatar from '../Common/UserAvatar';

interface LayoutProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export default function Layout({ currentView, onNavigate }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notifications = [
    { id: '1', message: 'Nativa FM - SP está online', date: '2024-02-13', read: false },
    { id: '2', message: 'Alpha FM - SP está online', date: '2024-02-13', read: false },
    { id: '3', message: 'Tropical FM - ES está online', date: '2024-02-13', read: false },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // Update currentView based on location
  useEffect(() => {
    const path = location.pathname.substring(1); // Remove leading slash
    if (path) {
      // Se a rota começa com 'admin/', use o caminho completo como view
      if (path.startsWith('admin/')) {
        onNavigate(path);
      } else {
        // Para outras rotas, use apenas o primeiro segmento
        onNavigate(path.split('/')[0]);
      }
    }
  }, [location, onNavigate]);

  // Handle navigation
  const handleNavigate = (view: string) => {
    onNavigate(view);
    navigate(`/${view}`);
  };

  // Get the display title based on currentView
  const getDisplayTitle = () => {
    if (currentView === 'admin/users') {
      return 'Gerenciar Usuários';
    }
    return currentView.charAt(0).toUpperCase() + currentView.slice(1);
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className="fixed top-0 right-0 left-64 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="h-full px-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">
            {getDisplayTitle()}
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 relative"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Notificações</h3>
                      <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                        Marcar todas como lidas
                      </button>
                    </div>
                    <div className="space-y-2">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-3 rounded-lg ${
                            notification.read ? 'bg-gray-50 dark:bg-gray-700' : 'bg-blue-50 dark:bg-blue-900'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${notification.read ? 'bg-gray-400' : 'bg-green-500'}`} />
                            <p className="text-sm flex-1 text-gray-700 dark:text-gray-200">{notification.message}</p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-4">
                            {notification.date}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {currentUser && (
                  <UserAvatar
                    email={currentUser.email || ''}
                    photoURL={currentUser.photoURL}
                    size="sm"
                  />
                )}
                <ChevronDown className="w-4 h-4 text-gray-700 dark:text-gray-200" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="py-1">
                    <button className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
                      <HelpCircle className="w-4 h-4" />
                      Ajuda
                    </button>
                    <button className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
                      <Settings className="w-4 h-4" />
                      Configurações
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar currentView={currentView} onNavigate={handleNavigate} />

      {/* Main Content */}
      <main className="ml-64 pt-16">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
