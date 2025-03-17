import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../lib/auth';
import { Home, BarChart3, FileText, Users, Type, Radio, LogOut, Clock, X } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export default function SidebarFixed({ currentView, onNavigate, onClose, isMobile }: SidebarProps) {
  const { userStatus, currentUser, logout } = useAuth();

  const baseMenuItems = [
    {
      name: 'Painel',
      icon: Home,
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
      name: 'Usuários',
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
    }
  ];

  // Usando o tipo correto para a comparação
  const menuItems = [...baseMenuItems, ...(userStatus && userStatus === UserStatus.ADMIN ? adminMenuItems : [])];

  const handleItemClick = (view: string) => {
    onNavigate(view);
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-navy-600 via-navy-700 to-navy-800">
      {/* Close Button for Mobile */}
      {isMobile && (
        <div className="flex justify-end p-4">
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Logo */}
      <div className="px-6 py-4">
        <img
          src="/logo-1280x256.png"
          alt="Logo"
          className="h-8 w-auto object-contain"
        />
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.view}
            onClick={() => handleItemClick(item.view)}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
              transition-colors duration-150 ease-in-out
              ${currentView === item.view
                ? 'bg-white/10 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/5'
              }
              ${isMobile ? 'text-base py-4' : ''}
            `}
            aria-current={currentView === item.view ? 'page' : undefined}
          >
            <item.icon className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0`} />
            <span className="truncate">{item.name}</span>
          </button>
        ))}
      </nav>

      {/* User Profile and Logout - Only on Mobile */}
      {isMobile && currentUser && (
        <div className="relative z-20 px-4 py-4 mt-auto border-t border-white/10">
          <button
            onClick={async () => {
              try {
                await logout();
              } catch (error) {
                console.error('Erro ao fazer logout:', error);
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/70 hover:text-white hover:bg-white/5 text-base font-medium"
            aria-label="Sair da conta"
          >
            <LogOut className="w-6 h-6 flex-shrink-0" />
            <span className="truncate">Sair</span>
          </button>
        </div>
      )}
    </div>
  );
}
