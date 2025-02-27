import React, { useState, useEffect } from 'react';
import { Bell, ChevronDown, HelpCircle, LogOut, Moon, Settings, Sun, Menu, X } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { CustomUser } from '../../types/customUser';
import { useNavigate, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import UserAvatar from '../Common/UserAvatar';

interface LayoutProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

const LayoutWithResponsive: React.FC<LayoutProps> = ({ currentView, onNavigate }) => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notifications = [
    { id: '1', message: 'Nativa FM - SP está online', date: '2024-02-13', read: false },
    { id: '2', message: 'Alpha FM - SP está online', date: '2024-02-13', read: false },
    { id: '3', message: 'Tropical FM - ES está online', date: '2024-02-13', read: false },
  ];

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024); // Using lg breakpoint (1024px)
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleNavigate = (view: string) => {
    onNavigate(view);
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  const getDisplayTitle = () => {
    if (currentView === 'admin/users') return 'Gerenciar Usuários';
    if (currentView === 'admin/abbreviations') return 'Abreviações';
    return currentView.charAt(0).toUpperCase() + currentView.slice(1);
  };

  const renderUserProfile = () => (
    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        {currentUser && (
          <UserAvatar
            email={currentUser.email || ''}
            photoURL={(currentUser as CustomUser).photoURL}
            size="sm"
          />
        )}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {currentUser?.email}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <button className="w-full px-3 py-2 text-left flex items-center gap-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
          <HelpCircle className="w-4 h-4" />
          Ajuda
        </button>
        <button className="w-full px-3 py-2 text-left flex items-center gap-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
          <Settings className="w-4 h-4" />
          Configurações
        </button>
        <button 
          onClick={handleLogout}
          className="w-full px-3 py-2 text-left flex items-center gap-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  );

  const renderThemeToggle = () => (
    <button
      onClick={toggleTheme}
      className="w-full px-3 py-2 flex items-center gap-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4" />
          <span>Modo Claro</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4" />
          <span>Modo Escuro</span>
        </>
      )}
    </button>
  );

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Mobile Menu Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <div className={`
          fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-navy-600 via-navy-700 to-navy-800
          transform transition-transform duration-300 ease-in-out z-50
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex justify-end p-4">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-white hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          {renderUserProfile()}
          <div className="p-4">
            {renderThemeToggle()}
          </div>
          <div className="mobile-menu">
            <Sidebar currentView={currentView} onNavigate={handleNavigate} />
          </div>
        </div>
      )}

      {/* Desktop Layout */}
      <div className="flex">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="w-64 bg-gradient-to-b from-navy-600 via-navy-700 to-navy-800">
            <Sidebar currentView={currentView} onNavigate={handleNavigate} />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
          {/* Header */}
          <header className="relative z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="h-full px-4 sm:px-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {isMobile && (
                  <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <Menu className="w-6 h-6" />
                  </button>
                )}
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {getDisplayTitle()}
                </h2>
              </div>

              {/* Desktop Header Controls */}
              {!isMobile && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                  >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>

                  {/* Profile Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      {currentUser && (
                        <UserAvatar
                          email={currentUser.email || ''}
                          photoURL={(currentUser as CustomUser).photoURL}
                          size="sm"
                        />
                      )}
                      <ChevronDown className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                    </button>

                    {showProfileMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-40">
                        <div className="py-1">
                          <button className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors">
                            <HelpCircle className="w-4 h-4" />
                            Ajuda
                          </button>
                          <button className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors">
                            <Settings className="w-4 h-4" />
                            Configurações
                          </button>
                          <button 
                            onClick={handleLogout}
                            className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Sair
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Main Content */}
          <main className="relative z-20 flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default LayoutWithResponsive;
