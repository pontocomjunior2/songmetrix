import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PasswordInput } from '../Common/Input';
import { PrimaryButton } from '../Common/Button';
import { ErrorAlert, SuccessAlert } from '../Common/Alert';
import Loading from '../Common/Loading';
import { supabase } from '../../lib/supabase-client';
import { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { RefreshCw } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false); // Estado para controlar se a sessão é válida
  const navigate = useNavigate();
  const { clearPasswordResetCache } = useAuth();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let retryCount = 0;
    const maxRetries = 3;

  const checkPasswordRecovery = async () => {
    try {
      console.log('[ResetPassword] 🔍 Iniciando verificação de recuperação de senha');

      // Verificar se há parâmetros de recuperação na URL
      const urlParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');
      const type = urlParams.get('type');

      console.log('[ResetPassword] 🔗 Parâmetros da URL:', {
        accessToken: !!accessToken,
        refreshToken: !!refreshToken,
        type,
        fullUrl: window.location.href
      });

        // Se temos tokens de recuperação na URL, processar
        if (accessToken && refreshToken && type === 'recovery') {
          console.log('[ResetPassword] Tokens de recuperação encontrados na URL');
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error('[ResetPassword] Erro ao definir sessão de recuperação:', error);

            // Tentar novamente se for erro de rede ou cache
            if (retryCount < maxRetries && (error.message.includes('network') || error.message.includes('cache'))) {
              retryCount++;
              console.log(`[ResetPassword] Tentando novamente (${retryCount}/${maxRetries})...`);
              setTimeout(checkPasswordRecovery, 1000 * retryCount);
              return;
            }

            setError('Link inválido ou expirado. Por favor, solicite a redefinição novamente.');
            setIsValidSession(false);
          } else if (data.session) {
            console.log('[ResetPassword] Sessão de recuperação estabelecida:', data.session);
            setIsValidSession(true);
            setError('');
          }
          setSessionChecked(true);
          return;
        }

        // Verificar sessão atual
        console.log('[ResetPassword] Verificando sessão atual...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[ResetPassword] Erro ao verificar sessão:', sessionError);

          // Tentar novamente para erros de rede
          if (retryCount < maxRetries && sessionError.message.includes('network')) {
            retryCount++;
            console.log(`[ResetPassword] Tentando verificar sessão novamente (${retryCount}/${maxRetries})...`);
            setTimeout(checkPasswordRecovery, 1000 * retryCount);
            return;
          }

          setError('Erro ao verificar o link. Tente novamente.');
          setIsValidSession(false);
          setSessionChecked(true);
          return;
        }

        if (session) {
          console.log('[ResetPassword] Sessão encontrada:', session.user?.id);
          // Verificar se é uma sessão de recuperação válida
          const isRecoverySession = session.user?.email_confirmed_at &&
                                    session.user?.recovery_sent_at &&
                                    new Date(session.user.recovery_sent_at) > new Date(Date.now() - 3600000); // 1 hora

          console.log('[ResetPassword] É sessão de recuperação válida:', isRecoverySession);

          if (isRecoverySession) {
            setIsValidSession(true);
            setError('');
          } else {
            setError('Esta sessão não é válida para redefinição de senha.');
            setIsValidSession(false);
          }
        } else {
          console.log('[ResetPassword] Nenhuma sessão encontrada, aguardando evento PASSWORD_RECOVERY...');
          // Aguardar um pouco para ver se o evento PASSWORD_RECOVERY chega
          timeoutId = setTimeout(() => {
            if (!isValidSession) {
              console.log('[ResetPassword] Timeout atingido, link considerado inválido');
              setError('Link inválido ou expirado. Por favor, solicite a redefinição novamente.');
              setIsValidSession(false);
            }
          }, 5000); // Aumentado para 5 segundos
        }

        setSessionChecked(true);
      } catch (err) {
        console.error('[ResetPassword] Erro inesperado na verificação:', err);

        // Tentar novamente para erros inesperados
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`[ResetPassword] Tentando novamente após erro (${retryCount}/${maxRetries})...`);
          setTimeout(checkPasswordRecovery, 1000 * retryCount);
          return;
        }

        setError('Erro inesperado. Tente novamente.');
        setIsValidSession(false);
        setSessionChecked(true);
      }
    };

    // Listener para mudanças de estado de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[ResetPassword] Evento de auth:', event, !!session);

      if (event === 'PASSWORD_RECOVERY' && session) {
        console.log('[ResetPassword] Evento PASSWORD_RECOVERY recebido');
        setIsValidSession(true);
        setError('');
        setSessionChecked(true);
        if (timeoutId) {
          clearTimeout(timeoutId);
          console.log('[ResetPassword] Timeout cancelado devido ao evento PASSWORD_RECOVERY');
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log('[ResetPassword] Token renovado, verificando se é sessão válida');
        // Verificar se ainda é uma sessão válida de recuperação
        const isRecoverySession = session.user?.recovery_sent_at &&
                                  new Date(session.user.recovery_sent_at) > new Date(Date.now() - 3600000);
        console.log('[ResetPassword] Sessão de recuperação após refresh:', isRecoverySession);
        if (isRecoverySession) {
          setIsValidSession(true);
          setError('');
        } else {
          console.log('[ResetPassword] Sessão não é mais válida após refresh');
          setError('Sua sessão expirou. Por favor, solicite um novo link de redefinição.');
          setIsValidSession(false);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[ResetPassword] Usuário desconectado');
        setIsValidSession(false);
        setError('Sua sessão foi encerrada. Por favor, solicite um novo link de redefinição.');
      }
    });

    checkPasswordRecovery();

    // Limpa o listener e timeout ao desmontar
    return () => {
      authListener?.subscription?.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []); // Removidas dependências problemáticas

  const handlePasswordReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!password || !confirmPassword) {
      setError('Por favor, preencha e confirme sua nova senha.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        setLoading(false);
        return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    // A sessão já deve ter sido estabelecida pelo listener do onAuthStateChange
    const { error: updateError } = await supabase.auth.updateUser({ password: password });

    setLoading(false);

    if (updateError) {
      console.error('🔥 ERRO na atualização de senha!');
      console.error('🔍 Mensagem completa:', JSON.stringify(updateError.message));
      console.error('🔍 Status HTTP:', updateError.status);
      console.error('🔍 Propriedades do erro:', Object.keys(updateError));
      console.error('🔍 Tipo do erro:', typeof updateError);
      console.error('🔍 Todo o erro:', updateError);

      // 🔍 ANALisar EXATAMENTE QUE ERRO ESTÁ VINDO
      console.log('🔍 Verificações booleanas:');
      console.log('   - message.toLowerCase().includes("same"):', updateError.message.toLowerCase().includes('same'));
      console.log('   - message.toLowerCase().includes("igual"):', updateError.message.toLowerCase().includes('igual'));
      console.log('   - message.includes("422"):', updateError.message.includes('422'));
      console.log('   - status === 422:', updateError.status === 422);
      console.log('   - message.includes("password should be"):', updateError.message.includes('password should be'));

      // 🔥 VERIFICACÃO ESPECÍFICA PARA SENHA IGUAL COM DEBUG ABAIXO
      let isSamePasswordError = false;
      if (updateError.message.toLowerCase().includes('same') ||
          updateError.message.toLowerCase().includes('igual') ||
          updateError.message.toLowerCase().includes('cannot be the same')) {
        isSamePasswordError = true;
        console.log('🔍 🎯 ENCONTROU: "same" ou "igual" na mensagem');
      } else if (updateError.status === 422 || updateError.message.includes('422')) {
        isSamePasswordError = true;
        console.log('🔍 🎯 ENCONTROU: HTTP 422 (senha igual)');
      }

      if (isSamePasswordError) {
        setError('⚠️ Você não pode usar a mesma senha atual. Por favor, escolha uma senha completamente diferente para continuar.');
        console.log('[ResetPassword] ✅ CORRETO: Erro identificado como senha igual - mensagem específica aplicada');
        return; // 🔥 Sair aqui se foi erro de senha igual
      }

      // Após verificar senha igual, continuar com outras verificações
      if (updateError.message.includes('session is missing') ||
          updateError.message.includes('session_not_found') ||
          updateError.message.includes('session expired') ||
          updateError.message.includes('invalid session')) {
        setError('Sua sessão expirou ou é inválida. Por favor, solicite a redefinição novamente.');
        setIsValidSession(false);
        console.log('[ResetPassword] ✅ Erro identificado como sessão inválida');
      } else if (updateError.message.includes('password should be')) {
        setError('A senha deve atender aos seguintes requisitos: mínimo 6 caracteres, contendo pelo menos 1 letra minúscula e 1 maiúscula. Recomendamos combinações com números e caracteres especiais para maior segurança.');
        console.log('[ResetPassword] ✅ Erro identificado como senha fraca');
      } else {
        setError('Não foi possível atualizar sua senha. Tente novamente ou solicite um novo link.');
        console.log('[ResetPassword] ℹ️ Erro genérico - detalhes:', updateError.message);
      }
    } else {
      setMessage('Sua senha foi atualizada com sucesso! Você será redirecionado para o login.');
      setPassword('');
      setConfirmPassword('');

      // 🔥 FORCE LOGOUT E CACHE CLEAN UP COMPLETA após troca de senha
      console.log('[ResetPassword] 🔥 Force logout and complete cache cleanup after password change...');

      // 1. Forçar logout imediatamente
      await supabase.auth.signOut().catch(err => console.error('[ResetPassword] Error during logout:', err));

      // 2. Limpar cache completamente
      clearPasswordResetCache();

      // 3. AGUARDAR MAIS TEMPO PARA MOSTRAR MENSAGEM DE SUCESSO
      setTimeout(async () => {
        console.log('[ResetPassword] 🔄 Redirecting with logout flag...');

        // Concatenando parâmetros especiais para garantir logout
        const logoutUrl = '/login?reset=true&logout=true&t=' + Date.now();
        console.log('[ResetPassword] Final logout URL:', logoutUrl);

        window.location.href = logoutUrl; // 🔥 FORCE SEM AUTO-LOGIN
      }, 3000); // 🔥 AUMENTADO PARA 3 SEGUNDOS PARA MOSTRAR MENSAGEM
    }
  };

  // Mostra loading enquanto verifica a sessão ou processa o form
  if (!sessionChecked) {
    return <Loading size="large" message="Verificando link..." />;
  }

  if (loading) {
      return <Loading size="large" message="Atualizando senha..." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-lg shadow-md">
        <div>
           <img
            className="mx-auto w-48 h-auto"
            src="/logo-1280x240-azul.png"
            alt="SongMetrix"
          />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Definir Nova Senha
          </h2>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {/* 🔥 MENSAGEM DE SUCESSO COM TEMPO PARA LER */}
        {message && (
          <div className="mb-6">
            <SuccessAlert message={message} />
            <div className="mt-2 text-sm text-center text-green-800 font-medium">
              🔄 Você será redirecionado para o login automaticamente em instantes...
            </div>
          </div>
        )}

        {/* Botão de emergência para limpar cache */}
        {error && (error.includes('expirou') || error.includes('inválida') || error.includes('Link')) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Problemas com cache detectados
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Clique no botão ao lado para limpar o cache e tentar novamente.
                </p>
              </div>
              <Button
                onClick={() => {
                  clearPasswordResetCache();
                  setTimeout(() => window.location.reload(), 500);
                }}
                variant="outline"
                size="sm"
                className="ml-4"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Limpar Cache
              </Button>
            </div>
          </div>
        )}

        {/* Só mostra o formulário se a sessão for válida e não houver erro bloqueante */}
        {isValidSession && !error.includes('expirou') && !error.includes('inválida') && (
          <form className="mt-8 space-y-6" onSubmit={handlePasswordReset}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <PasswordInput
                  id="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nova Senha (mínimo 6 caracteres)"
                  required
                  label="Nova Senha"
                  aria-label="Nova senha"
                />
              </div>
              <div>
                <PasswordInput
                  id="confirm-new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme a Nova Senha"
                  required
                  label="Confirmar Nova Senha"
                  aria-label="Confirmação da nova senha"
                />
              </div>
            </div>

            <div>
              <PrimaryButton type="submit" fullWidth isLoading={loading}>
                Salvar Nova Senha
              </PrimaryButton>
            </div>
          </form>
        )}
        {/* Link para voltar ao login caso haja erro de link inválido/expirado */}
        {(!isValidSession || error.includes('expirou') || error.includes('inválida')) && sessionChecked && (
             <div className="text-sm text-center mt-4">
                <Link
                    to="/login"
                    className="font-medium text-[#1a3891] hover:text-[#162d7a]"
                >
                    Voltar para o Login
                </Link>
             </div>
        )}
      </div>
    </div>
  );
}
