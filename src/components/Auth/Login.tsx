import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmailInput, PasswordInput } from '../Common/Input';
import { PrimaryButton } from '../Common/Button';
import { ErrorAlert } from '../Common/Alert';
import Loading from '../Common/Loading';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { login } = useAuth();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      // Verificar se os campos estão preenchidos
      if (!email || !password) {
        setError('Por favor, preencha todos os campos.');
        setLoading(false);
        return;
      }
      
      const { error } = await login(email, password);
      
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      
      // Se chegou até aqui, o login foi bem-sucedido
      // O redirecionamento será feito pela função login
    } catch (err) {
      console.error('Erro ao fazer login:', err);
      setError('Ocorreu um erro durante o login. Tente novamente.');
      setLoading(false);
    }
  };

  if (loading) {
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
