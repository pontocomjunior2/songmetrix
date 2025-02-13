import React, { useState } from 'react';
import { 
  Bell, 
  ChevronDown, 
  HelpCircle, 
  LayoutDashboard, 
  LogOut, 
  Moon, 
  Radio, 
  Settings, 
  Sun, 
  Timer, 
  TrendingUp, 
  FileText
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

export default function Layout({ children, currentView, onNavigate }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notifications = [
    { id: '1', message: 'Nativa FM - SP está online', date: '2024-02-13', read: false },
    { id: '2', message: 'Alpha FM - SP está online', date: '2024-02-13', read: false },
    { id: '3', message: 'Tropical FM - ES está online', date: '2024-02-13', read: false },
  ];

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className="fixed top-0 right-0 left-64 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="h-full px-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{currentView.charAt(0).toUpperCase() + currentView.slice(1)}</h2>
          <div className="flex items-center gap-4">
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
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Notificações</h3>
                  <button className="text-sm text-blue-600 hover:text-blue-700">Marcar todas como lidas</button>
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
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                alt="Profile"
                className="w-8 h-8 rounded-full"
              />
              <ChevronDown className="w-4 h-4" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="py-1">
                  <button className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <HelpCircle className="w-4 h-4" />
                    Ajuda
                  </button>
                  <button className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <Settings className="w-4 h-4" />
                    Configurações
                  </button>
                  <button className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400">
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="fixed top-0 left-0 w-64 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h1 className="text-2xl font-bold">SongMetrix</h1>
        </div>
        <nav className="mt-6">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center gap-3 px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 ${
              currentView === 'dashboard' ? 'border-blue-500' : 'border-transparent'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Painel
          </button>
          <button
            onClick={() => onNavigate('realtime')}
            className={`w-full flex items-center gap-3 px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 ${
              currentView === 'realtime' ? 'border-blue-500' : 'border-transparent'
            }`}
          >
            <Timer className="w-5 h-5" />
            Tempo Real
          </button>
          <button
            onClick={() => onNavigate('ranking')}
            className={`w-full flex items-center gap-3 px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 ${
              currentView === 'ranking' ? 'border-blue-500' : 'border-transparent'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            Ranking
          </button>
          <button
            onClick={() => onNavigate('radios')}
            className={`w-full flex items-center gap-3 px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 ${
              currentView === 'radios' ? 'border-blue-500' : 'border-transparent'
            }`}
          >
            <Radio className="w-5 h-5" />
            Rádios
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className={`w-full flex items-center gap-3 px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 ${
              currentView === 'reports' ? 'border-blue-500' : 'border-transparent'
            }`}
          >
            <FileText className="w-5 h-5" />
            Relatórios
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="ml-64 pt-16">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
