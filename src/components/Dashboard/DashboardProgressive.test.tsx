import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardProgressive from './DashboardProgressive';

// Mock the auth hook
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    currentUser: { id: 'test-user' },
    planId: 'TRIAL',
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    userHasPreferences: jest.fn().mockResolvedValue(true)
  })
}));

// Mock the progressive loading hook
jest.mock('../../hooks/useProgressiveLoading', () => ({
  useProgressiveLoading: () => ({
    loadingState: {
      essential: { isLoading: true, error: null, section: 'essential', data: null },
      secondary: { isLoading: false, error: null, section: 'secondary', data: null },
      optional: { isLoading: false, error: null, section: 'optional', data: null }
    },
    startLoading: jest.fn(),
    retrySection: jest.fn(),
    isComplete: false,
    hasErrors: false,
    progress: 33
  })
}));

// Mock Supabase
jest.mock('../../lib/supabase-client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } }
      })
    }
  }
}));

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('DashboardProgressive', () => {
  it('should render essential data skeleton when loading', () => {
    renderWithProviders(<DashboardProgressive />);
    
    // Should show loading state for essential data
    expect(screen.getByText('Carregando dados essenciais...')).toBeInTheDocument();
  });

  it('should show progress indicator when loading', () => {
    renderWithProviders(<DashboardProgressive />);
    
    // Should show progress bar
    const progressBar = document.querySelector('[style*="width: 33%"]');
    expect(progressBar).toBeInTheDocument();
  });
});