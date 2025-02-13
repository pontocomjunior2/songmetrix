import React from 'react';
import { 
  LayoutDashboard, 
  Timer, 
  TrendingUp, 
  Radio, 
  FileText 
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export default function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'realtime', label: 'Tempo Real', icon: Timer },
    { id: 'ranking', label: 'Ranking', icon: TrendingUp },
    { id: 'radios', label: 'Rádios', icon: Radio },
    { id: 'reports', label: 'Relatórios', icon: FileText },
  ];

  return (
    <aside className="fixed top-0 left-0 w-64 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SongMetrix</h1>
      </div>
      <nav className="mt-6">
        {menuItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border-l-4 ${
              currentView === id ? 'border-blue-500' : 'border-transparent'
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
