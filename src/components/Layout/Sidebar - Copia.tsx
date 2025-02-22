import React from 'react';
import { LayoutDashboard, Radio, BarChart3, Clock, Users, FileText, Type, X, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../lib/auth';
import UserAvatar from '../Common/UserAvatar';
import { CustomUser } from '../../types/customUser';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export default function Sidebar({ currentView, onNavigate, onClose, isMobile }: SidebarProps) {
  const { userStatus, currentUser, signOut } = useAuth();
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
    }
  ];

  const menuItems = isAdmin ? [...commonMenuItems, ...adminMenuItems] : commonMenuItems;

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleNavigate = (view: string) => {
    onNavigate(view);
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-navy-600 via-navy-700 to-navy-800">
      {/* Close Button for Mobile */}
      {isMobile && onClose && (
        <div className="flex justify-end p-4">
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Logo e Slogan */}
      <div className="relative z-20 p-6 flex flex-col items-center">
        <img
          src="/logo-1280x256.png"
          alt="SongMetrix"
          className="w-48 h-auto mb-3"
        />
        <p className="text-white/90 text-sm font-medium text-center">
          Inteligência musical para sua rádio
        </p>
      </div>

      {/* Menu de Navegação */}
      <nav className="relative z-20 flex-1 px-4">
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

      {/* User Profile and Logout - Only on Mobile */}
      {isMobile && currentUser && (
        <div className="relative z-20 px-4 py-4 mt-auto border-t border-white/10">
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

      {/* Padrão de Fundo */}
      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0)_100%)]"></div>
      <div className="absolute inset-0 z-10" style={{
        backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 1px, transparent 1px)`,
        backgroundSize: '30px 30px'
      }}></div>
    </div>
  );
}
