import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmailInput, PasswordInput } from '../Common/Input';
import { PrimaryButton } from '../Common/Button';
import { ErrorAlert } from '../Common/Alert';
import Loading from '../Common/Loading'; // Alterado aqui
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase-client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
  
    try {
      console.log('Tentando verificar o status para o email:', email);
  
      const { data, error: getUserError } = await supabase
        .from('users')
        .select('status')
        .eq('email', email);
  
      console.log('Resultado da consulta:', data);
  
      if (getUserError) {
        console.error('Erro ao verificar status do usuário:', getUserError);
        throw new Error(`Erro ao verificar status: ${getUserError.message}`);
      }
  
      if (!data || data.length === 0) {
        console.log('Nenhum usuário encontrado para o email:', email);
        throw new Error('Usuário não encontrado');
      }
  
      console.log('Status do usuário:', data[0].status);
  
      if (data[0].status === 'INATIVO') {
        navigate('/pending-approval', {
          state: {
            message: 'Sua conta está aguardando aprovação. Por favor, aguarde o contato do nosso atendimento.'
          }
        });
        return;
      }
  
      // Se o usuário não for inativo, prossiga com o login
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        console.error('Erro no signIn:', signInError);
        throw signInError;
      }
  
      // Login bem-sucedido, a navegação será tratada pelo signIn
    } catch (error: any) {
      console.error('Erro detalhado:', error);
      let errorMessage = 'Falha ao fazer login. Verifique suas credenciais.';
      
      if (error.message === 'Invalid login credentials') {
        errorMessage = 'Email ou senha incorretos.';
      } else if (error.message === 'Email not confirmed') {
        errorMessage = 'Por favor, confirme seu email antes de fazer login.';
      } else if (error.message === 'Usuário não encontrado') {
        errorMessage = 'Email não registrado. Por favor, verifique o email ou registre-se.';
      } else if (error.message.includes('Erro ao verificar status')) {
        errorMessage = 'Erro ao verificar o status do usuário. Tente novamente.';
      }
      
      setError(errorMessage);
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
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#122463] via-[#162d7a] to-[#1a3891] items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0)_100%)]" />
        <div 
          className="absolute inset-0 opacity-20" 
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2) 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
        />
        <div className="max-w-lg relative z-10">
          <img
            src="/logo-1280x256.png"
            alt="SongMetrix"
            className="w-3/4 h-auto mb-8"
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

          <form className="space-y-4" onSubmit={handleEmailLogin}>
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
