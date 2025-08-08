import React from 'react';
import { LayoutDashboard, Radio, BarChart3, Clock, Users, FileText, Type, X, LogOut, Brain, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../lib/auth';
import UserAvatar from '../Common/UserAvatar';
import { CustomUser } from '../../types/customUser';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onClose: () => void;
}

export default function SidebarMobile({ currentView, onNavigate, onClose }: SidebarProps) {
  const { userStatus, currentUser, logout } = useAuth();
  const isAdmin = userStatus === UserStatus.ADMIN;

  const commonMenuItems = [
    {
      name: 'Painel',
      icon: LayoutDashboard,
      view: 'dashboard'
    },
    {
      name: 'Rádios',
      icon: Radio,
      view: 'radios'
    },
    {
      name: 'Ranking',
      icon: BarChart3,
      view: 'ranking'
    },
    {
      name: 'Tempo Real',
      icon: Clock,
      view: 'realtime'
    },
    {
      name: 'Relatórios',
      icon: FileText,
      view: 'relatorios'
    }
  ];

  const adminMenuItems = [
    {
      name: 'Gerenciar Usuários',
      icon: Users,
      view: 'admin/users'
    },
    {
      name: 'Abreviações',
      icon: Type,
      view: 'admin/abbreviations'
    },
    {
      name: 'Gerenciar Streams',
      icon: Radio,
      view: 'admin/streams'
    },
    {
      name: 'Insights de IA',
      icon: Brain,
      view: 'admin/insights'
    },
    {
      name: 'Configurações de IA',
      icon: Settings,
      view: 'admin/llm-settings'
    }
  ];

  const menuItems = isAdmin ? [...commonMenuItems, ...adminMenuItems] : commonMenuItems;

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleNavigate = (view: string) => {
    onNavigate(view);
    onClose();
  };

  return (
    <div className="w-full flex flex-col h-screen bg-gradient-to-b from-navy-600 via-navy-700 to-navy-800">
      {/* Close Button */}
      <div className="flex justify-end p-4">
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 p-2"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Menu de Navegação */}
      <nav className="flex-1 px-4 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.view}>
              <button
                onClick={() => handleNavigate(item.view)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  currentView === item.view
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className={`w-5 h-5 ${
                  currentView === item.view
                    ? 'text-white'
                    : 'text-white/70'
                }`} />
                <span>{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile and Logout */}
      {currentUser && (
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-2 text-white">
            <UserAvatar
              email={currentUser.email || ''}
              photoURL={(currentUser as CustomUser)?.photoURL}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {currentUser.email}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 text-red-400 hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      )}
    </div>
  );
}
