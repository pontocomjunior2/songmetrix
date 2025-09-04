import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { LazyRoutes, RouteLoadingFallback } from '@/config/lazyRoutes';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import AdminRoute from '@/components/Auth/AdminRoute';
import FirstAccessRoute from '@/components/Auth/FirstAccessRoute';
import MainLayout from '@/components/Layout/MainLayout';
import { DevPerformanceMonitor } from '@/components/PerformanceMonitor/PerformanceMonitor';
import { PerformanceAlertIndicator } from '@/components/PerformanceAlerts/PerformanceAlerts';

const RootRoute = () => {
  return (
    <ProtectedRoute>
      <MainLayout />
    </ProtectedRoute>
  );
};

function App() {
  return (
    <AuthProvider>
      <DevPerformanceMonitor />
      <PerformanceAlertIndicator />
      <Routes>
        {/* Rotas Públicas */}
        <Route 
          path="/login" 
          element={
            <Suspense fallback={<RouteLoadingFallback routeName="Login" />}>
              <LazyRoutes.Login />
            </Suspense>
          } 
        />
        <Route 
          path="/register" 
          element={
            <Suspense fallback={<RouteLoadingFallback routeName="Register" />}>
              <LazyRoutes.Register />
            </Suspense>
          } 
        />
        <Route 
          path="/reset-password" 
          element={
            <Suspense fallback={<RouteLoadingFallback routeName="ResetPassword" />}>
              <LazyRoutes.RequestPasswordReset />
            </Suspense>
          } 
        />
        <Route 
          path="/update-password" 
          element={
            <Suspense fallback={<RouteLoadingFallback routeName="UpdatePassword" />}>
              <LazyRoutes.ResetPassword />
            </Suspense>
          } 
        />
        <Route 
          path="/pending-approval" 
          element={
            <Suspense fallback={<RouteLoadingFallback routeName="PendingApproval" />}>
              <LazyRoutes.PendingApproval />
            </Suspense>
          } 
        />
        <Route 
          path="/payment/success" 
          element={
            <Suspense fallback={<RouteLoadingFallback routeName="PaymentSuccess" />}>
              <LazyRoutes.PaymentSuccess />
            </Suspense>
          } 
        />
        <Route 
          path="/payment/canceled" 
          element={
            <Suspense fallback={<RouteLoadingFallback routeName="PaymentCanceled" />}>
              <LazyRoutes.PaymentCanceled />
            </Suspense>
          } 
        />
        <Route path="/first-access" element={<FirstAccessRoute />} />
        
        {/* Rotas Protegidas aninhadas */}
        <Route path="/" element={<RootRoute />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route 
            path="dashboard" 
            element={
              <Suspense fallback={<RouteLoadingFallback routeName="Dashboard" />}>
                <LazyRoutes.Dashboard />
              </Suspense>
            } 
          />
          <Route 
            path="ranking" 
            element={
              <Suspense fallback={<RouteLoadingFallback routeName="Ranking" />}>
                <LazyRoutes.Ranking />
              </Suspense>
            } 
          />
          <Route 
            path="realtime" 
            element={
              <Suspense fallback={<RouteLoadingFallback routeName="RealTime" />}>
                <LazyRoutes.RealTime />
              </Suspense>
            } 
          />
          <Route 
            path="radios" 
            element={
              <Suspense fallback={<RouteLoadingFallback routeName="Radios" />}>
                <LazyRoutes.Radios />
              </Suspense>
            } 
          />
          <Route 
            path="relatorios" 
            element={
              <Suspense fallback={<RouteLoadingFallback routeName="Relatorios" />}>
                <LazyRoutes.Relatorios />
              </Suspense>
            } 
          />
          <Route 
            path="spotify" 
            element={
              <Suspense fallback={<RouteLoadingFallback routeName="Spotify" />}>
                <LazyRoutes.Spotify />
              </Suspense>
            } 
          />
          <Route 
            path="plans" 
            element={
              <Suspense fallback={<RouteLoadingFallback routeName="Plans" />}>
                <LazyRoutes.Plans />
              </Suspense>
            } 
          />
          <Route 
            path="meu-plano" 
            element={
              <Suspense fallback={<RouteLoadingFallback routeName="MeuPlano" />}>
                <LazyRoutes.MeuPlanoPage />
              </Suspense>
            } 
          />
          <Route 
            path="admin/users" 
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoadingFallback routeName="AdminUsers" />}>
                  <LazyRoutes.UserList />
                </Suspense>
              </AdminRoute>
            } 
          />
          <Route 
            path="admin/abbreviations" 
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoadingFallback routeName="AdminAbbreviations" />}>
                  <LazyRoutes.RadioAbbreviations />
                </Suspense>
              </AdminRoute>
            } 
          />
          <Route 
            path="admin/streams" 
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoadingFallback routeName="AdminStreams" />}>
                  <LazyRoutes.StreamsManager />
                </Suspense>
              </AdminRoute>
            } 
          />
          <Route 
            path="admin/relay-streams" 
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoadingFallback routeName="AdminRelayStreams" />}>
                  <LazyRoutes.RelayStreamsManager />
                </Suspense>
              </AdminRoute>
            } 
          />
          <Route 
            path="admin/suggestions" 
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoadingFallback routeName="AdminSuggestions" />}>
                  <LazyRoutes.RadioSuggestions />
                </Suspense>
              </AdminRoute>
            } 
          />
          <Route 
            path="admin/emails" 
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoadingFallback routeName="AdminEmails" />}>
                  <LazyRoutes.EmailManager />
                </Suspense>
              </AdminRoute>
            } 
          />
          <Route 
            path="admin/notifications" 
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoadingFallback routeName="AdminNotifications" />}>
                  <LazyRoutes.NotificationsPage />
                </Suspense>
              </AdminRoute>
            } 
          />
          <Route 
            path="admin/insights" 
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoadingFallback routeName="AdminInsights" />}>
                  <LazyRoutes.InsightDashboardPage />
                </Suspense>
              </AdminRoute>
            } 
          />
          <Route 
            path="admin/llm-settings" 
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoadingFallback routeName="AdminLLMSettings" />}>
                  <LazyRoutes.LLMSettingsPage />
                </Suspense>
              </AdminRoute>
            } 
          />
          <Route 
            path="admin/prompts" 
            element={
              <AdminRoute>
                <Suspense fallback={<RouteLoadingFallback routeName="AdminPrompts" />}>
                  <LazyRoutes.PromptManagerPage />
                </Suspense>
              </AdminRoute>
            } 
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
