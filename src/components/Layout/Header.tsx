import React from 'react';
import { Bell, ChevronDown, HelpCircle, LogOut, Moon, Settings, Sun, Users } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { UserStatus } from '../../lib/firebase';
import UserAvatar from '../Common/UserAvatar';

interface HeaderProps {
  currentView: string;
  notifications: Array<{
    id: string;
    message: string;
    date: string;
    read: boolean;
  }>;
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
  showProfileMenu: boolean;
  setShowProfileMenu: (show: boolean) => void;
}

export default function Header({
  currentView,
  notifications,
  showNotifications,
  setShowNotifications,
  showProfileMenu,
  setShowProfileMenu
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { logout, userStatus, currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const isAdmin = userStatus === UserStatus.ADMIN;

  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
      <div className="h-full px-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {currentView.charAt(0).toUpperCase() + currentView.slice(1)}
        </h2>
        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 relative"
            >
              <Bell className="w-5 h-5" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">Notificações</h3>
                    <button className="text-sm text-blue-600 hover:text-blue-700">
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
                          <p className="text-sm flex-1">{notification.message}</p>
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
              <div className="flex items-center gap-2">
                {currentUser && (
                  <UserAvatar
                    email={currentUser.email || ''}
                    photoURL={currentUser.photoURL}
                    size="sm"
                  />
                )}
                <span className="text-sm font-medium hidden md:block">
                  {currentUser?.email}
                </span>
              </div>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    {currentUser && (
                      <UserAvatar
                        email={currentUser.email || ''}
                        photoURL={currentUser.photoURL}
                        size="md"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {currentUser?.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {isAdmin ? 'Administrador' : 'Usuário'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  {isAdmin && (
                    <button 
                      onClick={() => navigate('/admin/users')}
                      className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Users className="w-4 h-4" />
                      Gerenciar Usuários
                    </button>
                  )}
                  <button className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <HelpCircle className="w-4 h-4" />
                    Ajuda
                  </button>
                  <button className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700">
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
  );
}
