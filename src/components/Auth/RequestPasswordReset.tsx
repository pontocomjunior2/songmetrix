import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmailInput } from '../Common/Input';
import { PrimaryButton } from '../Common/Button';
import { ErrorAlert, SuccessAlert } from '../Common/Alert';
import Loading from '../Common/Loading';
import { supabase } from '../../lib/supabase-client';
import { REDIRECT_CONFIG } from '../../lib/supabase-redirect';

export default function RequestPasswordReset() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!email) {
      setError('Por favor, insira seu endereço de email.');
      setLoading(false);
      return;
    }

    console.log('[RequestPasswordReset] 🔐 Iniciando solicitação de reset para:', email);

    // Usar a configuração centralizada de redirecionamento
    const redirectTo = REDIRECT_CONFIG.passwordResetRedirectTo;
    console.log('[RequestPasswordReset] 📧 Redirect URL:', redirectTo);
    console.log('[RequestPasswordReset] 📧 Full REDIRECT_CONFIG:', REDIRECT_CONFIG);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo,
      });

      setLoading(false);

      if (resetError) {
        console.error('[RequestPasswordReset] ❌ Erro ao solicitar redefinição:', resetError);
        console.error('[RequestPasswordReset] ❌ Detalhes do erro:', {
          message: resetError.message,
          name: resetError.name,
          status: resetError.status
        });

        // Evitar expor detalhes do erro ao usuário, usar mensagem genérica
        if (resetError.message.includes('rate limit')) {
          setError('Você tentou solicitar a redefinição muitas vezes. Por favor, aguarde um pouco.');
        } else if (resetError.message.includes('Unable to validate email address')) {
          setError('Por favor, verifique se o endereço de email está correto.');
        } else if (resetError.message.includes('network') || resetError.message.includes('fetch')) {
          setError('Erro de conexão. Verifique sua internet e tente novamente.');
        } else {
          setError('Erro ao enviar o email de redefinição. Verifique o email digitado ou tente novamente mais tarde.');
        }
      } else {
        console.log('[RequestPasswordReset] ✅ Email de reset enviado com sucesso!');
        // Mensagem genérica para não confirmar existência de emails
        setMessage('Se um usuário com este email existir em nossa base, um link para redefinir sua senha foi enviado.');
        setEmail(''); // Limpar o campo após o envio
      }
    } catch (unexpectedError) {
      console.error('[RequestPasswordReset] 💥 Erro inesperado:', unexpectedError);
      setLoading(false);
      setError('Erro inesperado. Por favor, tente novamente.');
    }
  };

  if (loading) {
    return <Loading size="large" message="Enviando instruções..." />;
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
            Redefinir Senha
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Digite seu email para receber as instruções.
          </p>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {message && <SuccessAlert message={message} onClose={() => setMessage('')} />}

        <form className="mt-8 space-y-6" onSubmit={handleRequestReset}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <EmailInput
                id="email-request-reset"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu endereço de email"
                required
                label="Email"
                aria-label="Endereço de e-mail para redefinição de senha"
              />
            </div>
          </div>

          <div>
            <PrimaryButton type="submit" fullWidth isLoading={loading}>
              Enviar Instruções
            </PrimaryButton>
          </div>
        </form>

        <div className="text-sm text-center">
          <Link
            to="/login"
            className="font-medium text-[#1a3891] hover:text-[#162d7a]"
          >
            Voltar para o Login
          </Link>
        </div>
      </div>
    </div>
  );
}
