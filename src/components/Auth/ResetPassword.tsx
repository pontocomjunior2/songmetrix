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
    // Listener para o evento de recuperação de senha
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Evento PASSWORD_RECOVERY recebido, sessão:', session);
        if (session) {
          setIsValidSession(true);
          setError(''); // Limpa erro de link inválido se houver
        } else {
          // Isso não deveria acontecer normalmente se o evento é PASSWORD_RECOVERY
          setError('Link inválido ou expirado. Por favor, solicite a redefinição novamente.');
          setIsValidSession(false);
        }
        setSessionChecked(true);
      } else if (event === 'SIGNED_IN' && sessionChecked) {
        // Se já está logado de alguma forma e a checagem inicial passou
        // Mantém o estado atual
      } else if (!session && !sessionChecked) {
         // Se não há sessão e a verificação inicial ainda não ocorreu
         // Espera o evento PASSWORD_RECOVERY ou a verificação inicial
         // Se após um tempo não vier, considerar inválido
         setTimeout(() => {
            if (!isValidSession && !sessionChecked) {
                 setError('Link inválido ou expirado. Por favor, solicite a redefinição novamente.');
                 setSessionChecked(true);
                 setIsValidSession(false);
            }
         }, 2000); // Espera 2 segundos pelo evento
      }
    });

    // Verificação inicial da sessão (caso o usuário atualize a página)
    const checkInitialSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        // A sessão aqui pode não ser a de PASSWORD_RECOVERY ainda
        // O listener acima é mais confiável para o estado pós-clique no link
        if (!session && !sessionChecked) {
             // Se não há sessão inicial e o listener ainda não pegou o evento,
             // aguarda um pouco pelo listener.
        }
        // Se tiver uma sessão aqui, o listener provavelmente já tratou ou tratará
    };

    checkInitialSession();

    // Limpa o listener ao desmontar
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [sessionChecked, isValidSession]); // Adicionado isValidSession para reavaliar se necessário

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