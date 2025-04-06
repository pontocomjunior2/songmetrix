import React, { useState, useEffect } from 'react';
import { LogOut, Moon, Sun, Menu } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { CustomUser } from '../../types/customUser';
import { useNavigate, Outlet } from 'react-router-dom';
import SidebarFixed from './SidebarFixed';
import UserAvatar from '../Common/UserAvatar';
import SuggestRadioModal from '../Radios/SuggestRadioModal';
import NotificationBell from '../Notifications/NotificationBell';

interface LayoutProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

const MainLayout: React.FC<LayoutProps> = ({ currentView, onNavigate }) => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout, sendWelcomeEmail } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Efeito para enviar email de boas-vindas quando o usuário faz login pela primeira vez
  useEffect(() => {
    const checkEmailConfirmationAndSendWelcome = async () => {
      if (currentUser && currentUser.email_confirmed_at) {
        // Usuário está autenticado e email está confirmado
        sendWelcomeEmail();
      }
    };

    checkEmailConfirmationAndSendWelcome();
  }, [currentUser, sendWelcomeEmail]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleNavigate = (view: string) => {
    onNavigate(view);
    navigate(`/${view}`);
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  const getPageTitle = () => {
    if (currentView === 'dashboard') return 'Dashboard';
    if (currentView === 'ranking') return 'Ranking';
    if (currentView === 'realtime') return 'Tempo Real';
    if (currentView === 'radios') return 'Rádios';
    if (currentView === 'relatorios') return 'Relatórios';
    if (currentView === 'spotify') return 'Spotify Charts';
    if (currentView === 'admin/users') return 'Gerenciar Usuários';
    if (currentView === 'admin/abbreviations') return 'Abreviações';
    if (currentView === 'admin/streams') return 'Gerenciar Streams';
    if (currentView === 'admin/relay-streams') return 'Gerenciar Relay Streams';
    if (currentView === 'admin/emails') return 'Gerenciar Emails';
    if (currentView === 'admin/notifications') return 'Gerenciar Notificações';
    return '';
  };

  const handleCloseMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Mobile Menu Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40" 
          onClick={handleCloseMobileMenu}
        />
      )}

      {/* Sidebar Container */}
      <div 
        className={`
          fixed inset-y-0 left-0 transform transition-transform duration-300 ease-in-out z-50
          ${isMobile ? 'w-[85%] max-w-[300px]' : 'w-64'}
          ${isMobile ? (isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
        `}
      >
        <SidebarFixed 
          currentView={currentView} 
          onNavigate={handleNavigate}
          onClose={handleCloseMobileMenu}
          isMobile={isMobile}
        />
      </div>

      {/* Main Content */}
      <div className={`
        flex-1 flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900
        ${!isMobile ? 'lg:ml-64' : ''}
      `}>
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="h-full px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isMobile && (
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <Menu className="w-6 h-6" />
                </button>
              )}
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white truncate">
                {getPageTitle()}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {currentUser && (
                <SuggestRadioModal buttonClassName="mr-3 rounded-full font-medium" />
              )}
              
              <NotificationBell />

              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Profile Menu */}
              {currentUser && (
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <UserAvatar
                      email={currentUser.email || ''}
                      photoURL={(currentUser as CustomUser).photoURL}
                      size="sm"
                    />
                    {!isMobile && (
                      <span className="text-sm text-gray-700 dark:text-gray-200">
                        {currentUser.email}
                      </span>
                    )}
                  </button>

                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                      <div className="py-1">
                        {isMobile && currentUser.email && (
                          <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                            {currentUser.email}
                          </div>
                        )}
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
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
