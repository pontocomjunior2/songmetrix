import React from 'react';
import { LayoutDashboard, Radio, BarChart3, Clock, Users, FileText, Type } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../lib/firebase';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export default function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const { userStatus } = useAuth();

  const menuItems = [
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

  if (userStatus === UserStatus.ADMIN) {
    menuItems.push(
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
    );
  }

  return (
    <div className="w-full flex flex-col h-screen">
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
      <nav className="relative z-20 flex-1 px-4 pb-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.view}>
              <button
                onClick={() => onNavigate(item.view)}
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

      {/* Padrão de Fundo */}
      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0)_100%)]"></div>
      <div className="absolute inset-0 z-10" style={{
        backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 1px, transparent 1px)`,
        backgroundSize: '30px 30px'
      }}></div>
    </div>
  );
}
