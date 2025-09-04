import { lazy } from 'react';
import React from 'react';

// Route-based lazy loading configuration
export const LazyRoutes = {
  // Main application routes
  Dashboard: lazy(() => import('@/components/Dashboard')),
  Ranking: lazy(() => import('@/components/Ranking')),
  RealTime: lazy(() => import('@/components/RealTime')),
  Radios: lazy(() => import('@/components/Radios')),
  Relatorios: lazy(() => import('@/components/Relatorios')),
  Spotify: lazy(() => import('@/components/Spotify')),
  Plans: lazy(() => import('@/components/Plans/index')),
  MeuPlanoPage: lazy(() => import('@/pages/MeuPlanoPage')),
  
  // Admin routes - using lazy-loaded versions for heavy components
  UserList: lazy(() => import('@/components/Admin/LazyAdminComponents').then(module => ({ default: module.UserListLazy }))),
  RadioAbbreviations: lazy(() => import('@/components/Admin/RadioAbbreviations')),
  StreamsManager: lazy(() => import('@/components/Admin/LazyAdminComponents').then(module => ({ default: module.StreamsManagerLazy }))),
  RelayStreamsManager: lazy(() => import('@/components/Admin/LazyAdminComponents').then(module => ({ default: module.RelayStreamsManagerLazy }))),
  RadioSuggestions: lazy(() => import('@/components/Admin/LazyAdminComponents').then(module => ({ default: module.RadioSuggestionsLazy }))),
  EmailManager: lazy(() => import('@/components/Admin/LazyAdminComponents').then(module => ({ default: module.EmailManagerLazy }))),
  NotificationsPage: lazy(() => import('@/pages/Admin/NotificationsPage')),
  InsightDashboardPage: lazy(() => import('@/pages/Admin/InsightDashboardPage')),
  LLMSettingsPage: lazy(() => import('@/pages/Admin/LLMSettingsPage')),
  PromptManagerPage: lazy(() => import('@/pages/Admin/PromptManagerPage')),
  
  // Auth routes
  Login: lazy(() => import('@/components/Auth/Login')),
  Register: lazy(() => import('@/components/Auth/Register')),
  RequestPasswordReset: lazy(() => import('@/components/Auth/RequestPasswordReset')),
  ResetPassword: lazy(() => import('@/components/Auth/ResetPassword')),
  PendingApproval: lazy(() => import('@/components/Auth/PendingApproval')),
  
  // Payment routes
  PaymentSuccess: lazy(() => import('@/components/Payment/PaymentSuccess')),
  PaymentCanceled: lazy(() => import('@/components/Payment/PaymentCanceled')),
};

// Simple loading component
const LoadingComponent: React.FC<{ message?: string }> = ({ message = 'Carregando...' }) => {
  return React.createElement('div', { className: 'flex items-center justify-center p-8' },
    React.createElement('div', { className: 'text-center' },
      React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4' }),
      React.createElement('p', { className: 'text-gray-600' }, message)
    )
  );
};

// Loading fallback component with route-specific messages
export const RouteLoadingFallback: React.FC<{ routeName?: string }> = ({ routeName }) => {
  const getLoadingMessage = (route?: string) => {
    switch (route) {
      case 'Dashboard':
        return 'Carregando dashboard...';
      case 'Ranking':
        return 'Carregando ranking...';
      case 'RealTime':
        return 'Carregando dados em tempo real...';
      case 'Radios':
        return 'Carregando rádios...';
      case 'Relatorios':
        return 'Carregando relatórios...';
      case 'Spotify':
        return 'Carregando integração Spotify...';
      case 'Plans':
        return 'Carregando planos...';
      default:
        return 'Carregando...';
    }
  };

  return React.createElement(LoadingComponent, { message: getLoadingMessage(routeName) });
};

// Chunk naming for better debugging
export const chunkNames = {
  dashboard: 'dashboard',
  ranking: 'ranking',
  realtime: 'realtime',
  radios: 'radios',
  relatorios: 'relatorios',
  spotify: 'spotify',
  plans: 'plans',
  admin: 'admin',
  auth: 'auth',
  payment: 'payment',
} as const;