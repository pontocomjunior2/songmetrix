import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EmailInput, PasswordInput } from '../Common/Input';
import { PrimaryButton } from '../Common/Button';
import { ErrorAlert } from '../Common/Alert';
import Loading from '../Common/Loading';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await signInWithEmail(email, password);
      navigate('/');
    } catch (error) {
      setError('Falha ao fazer login. Verifique suas credenciais.');
      console.error('Erro no login:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      await signInWithGoogle();
      navigate('/');
    } catch (error) {
      setError('Falha ao fazer login com Google.');
      console.error('Erro no login com Google:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading size="large" message="Autenticando..." />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo - Logo e Slogan */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy-700 items-center justify-center p-12">
        <div className="max-w-lg">
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
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Vamos começar
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Bem vindo! Por favor, faça o login para continuar.
            </p>
          </div>

          {error && (
            <ErrorAlert message={error} onClose={() => setError('')} />
          )}

          <form onSubmit={handleEmailLogin}>
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

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">ou</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-500"
            >
              <img
                className="h-5 w-5 mr-2"
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google logo"
              />
              Continuar com Google
            </button>
          </div>
        </div>

        <div className="text-sm text-center mt-6">
          <Link
            to="/register"
            className="font-medium text-navy-600 hover:text-navy-500"
          >
            Não tem uma conta? Registre-se
          </Link>
        </div>
      </div>
    </div>
  );
}
