import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmailInput, PasswordInput } from '../Common/Input';
import { PrimaryButton } from '../Common/Button';
import { ErrorAlert } from '../Common/Alert';
import Loading from '../Common/Loading';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase-client';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, clearPasswordResetCache, loading: authLoading, isInitialized, currentUser } = useAuth();
  const hasClearedCache = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 🔥 CONTROLE DE SUBMISSÃO MÚLTIPLA COM ESTADO

  // EMERGÊNCIA: Limpar cache completamente na primeira visita
  useEffect(() => {
    console.log('[Login] 🟡 Login component mounted, pathname:', window.location.pathname);
    if (!hasClearedCache.current) {
      console.log('[Login Emergency] Executing complete cache cleanup...');

      try {
        // Limpeza completa de localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) keysToRemove.push(key);
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Limpeza completa de sessionStorage
        sessionStorage.clear();

        // Limpeza de URL hash se houver
        if (window.location.hash.includes('access_token') ||
            window.location.hash.includes('refresh_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }

        // Limpeza de URL search params
        if (window.location.search.includes('reset=')) {
          window.history.replaceState(null, '', window.location.pathname);
        }

        console.log('[Login Emergency] Cache completely cleared');

      } catch (error) {
        console.error('[Login Emergency] Error during cache cleanup:', error);
      }

      hasClearedCache.current = true;
    }
  }, []);

  // Efeito para sincronizar o estado de loading com o AuthContext
  useEffect(() => {
    if (!authLoading && loading && isInitialized) {
      console.log('[Login] AuthContext finished loading, resetting local loading state');
      setLoading(false);
      setIsSubmitting(false); // 🔥 RESETA FLAG QUANDO AUTENTICAÇÃO TERMINA
    }
  }, [authLoading, loading, isInitialized]);

  // 🔥 CONTROLE ROBUSTO DE NAVEGAÇÃO APÓS RESET DE SENHA
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    // 🚫 BLOQUEAR AUTO-NAVEGAÇÃO SE VEIO DE RESET + LOGOUT
    const fromResetWithLogout = urlParams.get('reset') === 'true' && urlParams.get('logout') === 'true';

    if (fromResetWithLogout) {
      console.log('[Login] 🔒 Block auto-navigation: reset with forced logout detected');
      return; // Não navegues automaticamente
    }

    // ✅ SOMENTE NAVEgue SE USUÁRIO REALMENTE LOGADO E SEM PARÂMETRO DE RESET
    if (isInitialized && !authLoading && currentUser && !loading && !fromResetWithLogout) {
      console.log('[Login] 🚀 User authenticated after normal login, navigating to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [isInitialized, authLoading, currentUser, loading, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    // 🔥 PREVENIR SUBMISSÃO MÚLTIPLA
    if (isSubmitting || loading) {
      console.log('[Login] ❌ Blocked multiple submission - already processing');
      return;
    }

    // 🔥 SET FLAG DE SUBMISSÃO PARA PREVENIR SUBMISSÕES MÚLTIPLAS
    setIsSubmitting(true);

    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      setIsSubmitting(false); // 🔥 RESETA FLAG SE VALIDAÇÃO FALHAR
      return;
    }

    console.log('[Login] Starting login process for email:', email);
    setLoading(true);

    try {
      console.log('[Login] 🔐 Calling login function with email:', email);
      console.log('[Login] 📊 Login attempt details:', {
        email: email,
        passwordLength: password.length,
        timestamp: new Date().toISOString()
      });

      const { error: loginError } = await login(email, password);

      if (loginError) {
        console.error('[Login] ❌ Login error:', loginError);
        console.error('[Login] 📊 Error details:', {
          message: loginError.message,
          status: loginError.status,
          name: loginError.name,
          code: (loginError as any).code || 'No code'
        });

        // 🔥 DIAGNOSTICAR ESPECIFICAMENTE ERROS DE NOVOS USUÁRIOS
        if (loginError.message?.includes('Invalid login credentials') ||
            loginError.message?.includes('Email not confirmed') ||
            loginError.status === 400) {
          console.error('[Login] 🚨 NEW USER ISSUE DETECTED:', {
            errorType: 'Authentication failure for new user',
            possibleCauses: [
              'User account not created properly',
              'Email not confirmed',
              'Wrong password',
              'Account disabled',
              'Supabase configuration issue'
            ],
            recommendedActions: [
              'Check if user exists in Supabase Auth',
              'Verify email confirmation status',
              'Test with existing user credentials',
              'Check Supabase project settings'
            ]
          });
        }

        setError(loginError.message);
        setLoading(false);
        setIsSubmitting(false); // 🔥 RESETA FLAG APÓS ERRO
      } else {
        console.log('[Login] ✅ Login function completed without error');
        console.log('[Login] 🎉 User successfully authenticated');
        // 🔥 Não reseta aqui - deixa AuthContext controlar quando concluído
      }

    } catch (err: any) {
      console.error('[Login] 💥 Unexpected error during login process:', err);
      console.error('[Login] 📊 Exception details:', {
        message: err?.message,
        stack: err?.stack,
        name: err?.name,
        status: err?.status,
        code: err?.code || 'No code'
      });
      setError('Ocorreu um erro inesperado durante o login.');
      setLoading(false);
      setIsSubmitting(false); // 🔥 RESETA FLAG APÓS ERRO EXCEPTION
    }
  };



  // Mostrar loading apenas durante o processo de login iniciado pelo usuário
  if (loading && authLoading) {
    console.log('[Login] Showing login loading:', { componentLoading: loading, authLoading, isInitialized });
    return <Loading size="large" message="Autenticando..." />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo - Logo e Slogan */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#122463] via-[#162d7a] to-[#1a3891] items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0)_100%)]"></div>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2) 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}></div>
        <div className="max-w-lg relative z-10">
          <img
            src="/logo-1280x256.png"
            alt="SongMetrix"
            className="w-full h-auto mb-8"
          />
          <h2 className="text-3xl font-bold text-white mb-4">
            Inteligência musical para sua rádio
          </h2>
        </div>
      </div>

      {/* Lado Direito - Formulário de Login */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-md w-full space-y-4 md:space-y-6">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              Vamos começar
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Bem vindo! Por favor, faça o login para continuar.
            </p>
          </div>

          {error && (
            <ErrorAlert message={error} onClose={() => setError('')} />
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <EmailInput
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
              />
            </div>
            <div>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                required
              />
            </div>

            <div>
              <PrimaryButton
                type="submit"
                fullWidth
                isLoading={loading}
              >
                Continuar com Email
              </PrimaryButton>
            </div>
          </form>

          <div className="text-sm text-center">
            <Link
              to="/reset-password"
              className="font-medium text-gray-600 hover:text-gray-800"
            >
              Esqueceu a senha?
            </Link>
          </div>

          <div className="text-sm text-center">
            <span className="text-gray-600">Não tem uma conta?</span>{' '}
            <Link
              to="/register"
              className="font-medium text-[#1a3891] hover:text-[#162d7a]"
            >
              Registre-se
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
