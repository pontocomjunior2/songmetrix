import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EmailInput, PasswordInput } from '../Common/Input';
import { PrimaryButton } from '../Common/Button';
import { ErrorAlert } from '../Common/Alert';
import Loading from '../Common/Loading';
import { supabase } from '../../lib/supabase-client';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const validatePassword = (password: string): boolean => {
    // Pelo menos 6 caracteres, 1 caractere especial e 1 letra maiúscula
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{6,})/;
    return passwordRegex.test(password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      return setError('As senhas não coincidem');
    }

    if (!validatePassword(password)) {
      return setError(
        'A senha deve ter pelo menos 6 caracteres, 1 caractere especial e 1 letra maiúscula'
      );
    }

    try {
      setError('');
      setLoading(true);

      // Sign up with Supabase Auth
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            status: 'TRIAL' // Usuários começam com status TRIAL para período de teste de 7 dias
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!user) throw new Error('No user data after signup');

      // Create user record in public.users table
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          status: 'TRIAL', // Usuários começam com status TRIAL para período de teste de 7 dias
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error creating user profile:', insertError);
        // Even if there's an error creating the profile, the auth user was created
        // So we should still show the email confirmation message
      }

      // Sign out the user and redirect to pending approval
      await supabase.auth.signOut();
      
      navigate('/pending-approval', { 
        state: { 
          message: 'Por favor, verifique seu email para confirmar seu cadastro. Após a confirmação, você terá acesso ao sistema com 7 dias gratuitos para testar todas as funcionalidades.' 
        } 
      });

    } catch (error: any) {
      console.error('Erro no registro:', error);
      let errorMessage = 'Falha ao criar conta. Por favor, tente novamente.';

      if (error.message.includes('already registered')) {
        errorMessage = 'Este email já está registrado.';
      } else if (error.message.includes('valid email')) {
        errorMessage = 'Por favor, forneça um email válido.';
      } else if (error.message.includes('weak password')) {
        errorMessage = 'A senha fornecida é muito fraca.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading size="large" message="Criando sua conta..." />;
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

      {/* Lado Direito - Formulário de Registro */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Criar nova conta
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Preencha os dados abaixo para se registrar
            </p>
            <div className="mt-2 p-3 bg-blue-50 rounded-md text-blue-700 text-sm">
              <p className="font-medium">Período de avaliação gratuito!</p>
              <p>Ao se cadastrar, você terá 7 dias gratuitos para testar todas as funcionalidades do sistema.</p>
            </div>
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
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar Senha"
                required
              />
            </div>

            <div>
              <PrimaryButton
                type="submit"
                fullWidth
                isLoading={loading}
              >
                Criar conta
              </PrimaryButton>
            </div>
          </form>

          <div className="text-sm text-center">
            <Link
              to="/login"
              className="font-medium text-[#1a3891] hover:text-[#162d7a]"
            >
              Já tem uma conta? Faça login
            </Link>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            <p>Requisitos da senha:</p>
            <ul className="list-disc list-inside">
              <li>Mínimo de 6 caracteres</li>
              <li>Pelo menos 1 caractere especial (!@#$%^&*)</li>
              <li>Pelo menos 1 letra maiúscula</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
