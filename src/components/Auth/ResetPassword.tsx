import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PasswordInput } from '../Common/Input';
import { PrimaryButton } from '../Common/Button';
import { ErrorAlert, SuccessAlert } from '../Common/Alert';
import Loading from '../Common/Loading';
import { supabase } from '../../lib/supabase-client';
import { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false); // Estado para controlar se a sessão é válida
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkPasswordRecovery = async () => {
      try {
        // Verificar se há parâmetros de recuperação na URL
        const urlParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');
        const type = urlParams.get('type');

        // Se temos tokens de recuperação na URL, processar
        if (accessToken && refreshToken && type === 'recovery') {
          console.log('Tokens de recuperação encontrados na URL');
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error('Erro ao definir sessão de recuperação:', error);
            setError('Link inválido ou expirado. Por favor, solicite a redefinição novamente.');
            setIsValidSession(false);
          } else if (data.session) {
            console.log('Sessão de recuperação estabelecida:', data.session);
            setIsValidSession(true);
            setError('');
          }
          setSessionChecked(true);
          return;
        }

        // Verificar sessão atual
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Erro ao verificar sessão:', sessionError);
          setError('Erro ao verificar o link. Tente novamente.');
          setIsValidSession(false);
          setSessionChecked(true);
          return;
        }

        if (session) {
          // Verificar se é uma sessão de recuperação válida
          const isRecoverySession = session.user?.email_confirmed_at &&
                                   session.user?.recovery_sent_at &&
                                   new Date(session.user.recovery_sent_at) > new Date(Date.now() - 3600000); // 1 hora

          if (isRecoverySession) {
            setIsValidSession(true);
            setError('');
          } else {
            setError('Esta sessão não é válida para redefinição de senha.');
            setIsValidSession(false);
          }
        } else {
          // Aguardar um pouco para ver se o evento PASSWORD_RECOVERY chega
          timeoutId = setTimeout(() => {
            if (!isValidSession) {
              setError('Link inválido ou expirado. Por favor, solicite a redefinição novamente.');
              setIsValidSession(false);
            }
          }, 3000); // Aumentado para 3 segundos
        }

        setSessionChecked(true);
      } catch (err) {
        console.error('Erro inesperado na verificação:', err);
        setError('Erro inesperado. Tente novamente.');
        setIsValidSession(false);
        setSessionChecked(true);
      }
    };

    // Listener para mudanças de estado de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Evento de auth:', event, session);

      if (event === 'PASSWORD_RECOVERY' && session) {
        setIsValidSession(true);
        setError('');
        setSessionChecked(true);
        if (timeoutId) clearTimeout(timeoutId);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Verificar se ainda é uma sessão válida de recuperação
        const isRecoverySession = session.user?.recovery_sent_at &&
                                 new Date(session.user.recovery_sent_at) > new Date(Date.now() - 3600000);
        if (isRecoverySession) {
          setIsValidSession(true);
          setError('');
        }
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
      console.error('Erro ao atualizar a senha:', updateError);
      if (updateError.message.includes('same password')) {
          setError('A nova senha não pode ser igual à senha antiga.');
      } else if (updateError.message.includes('session is missing')) {
           setError('Sua sessão expirou ou é inválida. Por favor, solicite a redefinição novamente.');
           setIsValidSession(false); // Marca como inválida
      } else {
           setError('Não foi possível atualizar sua senha. Tente novamente ou solicite um novo link.');
      }
    } else {
      setMessage('Sua senha foi atualizada com sucesso! Você será redirecionado para o login.');
      setPassword('');
      setConfirmPassword('');
      // O Supabase pode invalidar a sessão atual após a troca, então redirecionamos
      setTimeout(() => navigate('/login'), 3000);
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
        {message && <SuccessAlert message={message} />} {/* Mensagem de sucesso não precisa ser fechável aqui */}

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