import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Home, BarChart3, FileText, Users, Type, Radio, LogOut, Clock, X, ChevronDown, Mail, MessageSquare, Bell, Brain, Settings } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import WhatsAppContact from '../Common/WhatsAppContact';
import { useNavigate } from 'react-router-dom';

interface SidebarProps {
  pathname: string;
  onClose?: () => void;
  isMobile?: boolean;
}

interface MenuItem {
  name: string;
  icon: React.ElementType;
  view: string;
  hasSubMenu?: boolean;
  subItems?: Array<{
    name: string;
    view: string;
  }>;
}

const SidebarFixed: React.FC<SidebarProps> = ({ pathname, onClose, isMobile }: SidebarProps) => {
  const { planId, currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);

  const baseMenuItems: MenuItem[] = [
    {
      name: 'Dashboard',
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

  const adminMenuItems: MenuItem[] = [
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
      name: 'Gerenciar Rádios',
      icon: Radio,
      view: 'admin/radios',
      hasSubMenu: true,
      subItems: [
        {
          name: 'Streams',
          view: 'admin/streams'
        },
        {
          name: 'Relay',
          view: 'admin/relay-streams'
        },
        {
          name: 'Sugestões',
          view: 'admin/suggestions'
        }
      ]
    },
    {
      name: 'Gerenciar Emails',
      icon: Mail,
      view: 'admin/emails'
    },
    {
      name: 'Notificações',
      icon: Bell,
      view: 'admin/notifications'
    },
    {
      name: 'Inteligência Artificial',
      icon: Brain,
      view: 'admin/ai',
      hasSubMenu: true,
      subItems: [
        {
          name: 'Painel de Insights',
          view: 'admin/insights'
        },
        {
          name: 'Configurações de IA',
          view: 'admin/llm-settings'
        },
        {
          name: 'Gerenciar Prompts',
          view: 'admin/prompts'
        }
      ]
    }
  ];

  const isAdmin = planId === 'ADMIN';
  const menuItems: MenuItem[] = [...baseMenuItems, ...(isAdmin ? adminMenuItems : [])];

  const handleItemClick = (view: string, hasSubMenu?: boolean) => {
    if (hasSubMenu) return;
    navigate(`/${view}`);
    if (isMobile && onClose) {
      onClose();
    }
  };

  const isSubMenuActive = (item: MenuItem) => {
    return item.subItems && item.subItems.some(sub => `/${sub.view}` === pathname);
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
        {menuItems.map((item) => {
          const isActive = `/${item.view}` === pathname || isSubMenuActive(item);
          return (
          <div 
            key={item.view} 
            className="relative"
            onMouseEnter={() => setHoveredMenu(item.view)}
            onMouseLeave={() => setHoveredMenu(null)}
          >
            <div
              onClick={() => handleItemClick(item.view, item.hasSubMenu)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                transition-colors duration-150 ease-in-out cursor-pointer
                ${isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
                }
                ${isMobile ? 'text-base py-4' : ''}
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0`} />
              <span className="truncate">{item.name}</span>
              {item.hasSubMenu && (
                <ChevronDown 
                  className={`ml-auto w-4 h-4 transition-transform duration-200 ${
                    hoveredMenu === item.view || isActive ? 'rotate-180' : ''
                  }`} 
                />
              )}
            </div>
            
            {item.subItems && (
              <AnimatePresence>
                {(hoveredMenu === item.view || isMobile || isActive) && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="ml-8 mt-1 space-y-1 overflow-hidden"
                  >
                    {item.subItems.map((subItem) => {
                      const isSubItemActive = `/${subItem.view}` === pathname;
                      return (
                      <motion.button
                        key={subItem.view}
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => handleItemClick(subItem.view)}
                        className={`
                          w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium
                          transition-colors duration-150 ease-in-out
                          ${isSubItemActive
                            ? 'bg-white/10 text-white'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                          }
                        `}
                      >
                        <span className="truncate">{subItem.name}</span>
                      </motion.button>
                    );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        );
        })}
      </nav>

      {/* Contact Links */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="text-white/70 text-xs font-medium px-4 pb-2">Precisa de Ajuda?</div>
        <WhatsAppContact className="px-2" />
      </div>

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
};

export default SidebarFixed;
