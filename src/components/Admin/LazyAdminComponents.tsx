import React, { lazy, Suspense } from 'react';
import { LazyWrapper } from '@/components/LazyWrapper';
import Loading from '@/components/Common/Loading';

// Lazy load heavy admin components
export const LazyUserList = lazy(() => import('./UserList'));
export const LazyStreamsManager = lazy(() => import('./StreamsManager'));
export const LazyRelayStreamsManager = lazy(() => import('./RelayStreamsManager'));
export const LazyEmailManager = lazy(() => import('./EmailManager'));
export const LazyRadioSuggestions = lazy(() => import('./RadioSuggestions'));

// Wrapper components with loading states
export const UserListLazy: React.FC = () => (
  <LazyWrapper
    threshold={0.1}
    rootMargin="100px"
    loadingMessage="Carregando lista de usuários..."
    minHeight="400px"
  >
    <Suspense fallback={<Loading message="Carregando lista de usuários..." />}>
      <LazyUserList />
    </Suspense>
  </LazyWrapper>
);

export const StreamsManagerLazy: React.FC = () => (
  <LazyWrapper
    threshold={0.1}
    rootMargin="100px"
    loadingMessage="Carregando gerenciador de streams..."
    minHeight="400px"
  >
    <Suspense fallback={<Loading message="Carregando gerenciador de streams..." />}>
      <LazyStreamsManager />
    </Suspense>
  </LazyWrapper>
);

export const RelayStreamsManagerLazy: React.FC = () => (
  <LazyWrapper
    threshold={0.1}
    rootMargin="100px"
    loadingMessage="Carregando gerenciador de relay streams..."
    minHeight="400px"
  >
    <Suspense fallback={<Loading message="Carregando gerenciador de relay streams..." />}>
      <LazyRelayStreamsManager />
    </Suspense>
  </LazyWrapper>
);

export const EmailManagerLazy: React.FC = () => (
  <LazyWrapper
    threshold={0.1}
    rootMargin="100px"
    loadingMessage="Carregando gerenciador de emails..."
    minHeight="400px"
  >
    <Suspense fallback={<Loading message="Carregando gerenciador de emails..." />}>
      <LazyEmailManager />
    </Suspense>
  </LazyWrapper>
);

export const RadioSuggestionsLazy: React.FC = () => (
  <LazyWrapper
    threshold={0.1}
    rootMargin="100px"
    loadingMessage="Carregando sugestões de rádios..."
    minHeight="400px"
  >
    <Suspense fallback={<Loading message="Carregando sugestões de rádios..." />}>
      <LazyRadioSuggestions />
    </Suspense>
  </LazyWrapper>
);

export default {
  UserListLazy,
  StreamsManagerLazy,
  RelayStreamsManagerLazy,
  EmailManagerLazy,
  RadioSuggestionsLazy,
};