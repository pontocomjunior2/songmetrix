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

      // Usar a função signUp do AuthContext
      const { error: signUpError, should_redirect, message } = await signUp(email, password);

      if (signUpError) throw signUpError;

      // O registro na tabela users já foi criado pelo AuthContext.signUp
      // Não precisamos criar novamente aqui
      
      // Atualizar os metadados do usuário explicitamente para garantir o status TRIAL
      const { error: updateError } = await supabase.auth.updateUser({
        data: { status: 'TRIAL' }
      });
      
      if (updateError) {
        console.error('Erro ao atualizar metadados do usuário:', updateError);
        // Continuar mesmo com erro, pois o usuário foi criado
      }
      
      // Só fazer logout se should_redirect não for explicitamente false
      if (should_redirect !== false) {
        // Deslogar o usuário após o registro
        await supabase.auth.signOut();
      }
      
      // Personalizar a mensagem se fornecida
      const customMessage = message || 'Por favor, verifique seu email para confirmar seu cadastro. Após a confirmação, você terá acesso ao sistema com 7 dias gratuitos para testar todas as funcionalidades. Se não encontrar o email, verifique sua caixa de spam.';
      
      // Navigate to pending-approval
      navigate('/pending-approval', { 
        state: { 
          message: customMessage 
        },
        replace: true  // Isso garante que o usuário não possa voltar para a página anterior
      });
    } catch (error: any) {
      console.error('Erro no registro:', error);
      let errorMessage = 'Falha ao criar conta. Por favor, tente novamente.';

      // Tratamento de erros mais detalhado
      if (typeof error === 'object' && error !== null) {
        if (error.message) {
          if (error.message.includes('already registered') || error.message.includes('already exists')) {
            errorMessage = 'Este email já está registrado.';
          } else if (error.message.includes('valid email')) {
            errorMessage = 'Por favor, forneça um email válido.';
          } else if (error.message.includes('weak password')) {
            errorMessage = 'A senha fornecida é muito fraca.';
          } else if (error.message.includes('database') || error.message.includes('insert') || error.message.includes('update')) {
            errorMessage = 'Erro ao criar perfil do usuário. Por favor, tente novamente.';
          } else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('connection')) {
            errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
          }
          
          // Caso a mensagem de erro ainda não tenha sido personalizada, usar a mensagem original
          if (errorMessage === 'Falha ao criar conta. Por favor, tente novamente.') {
            // Mostrar os primeiros 100 caracteres da mensagem de erro para fins de diagnóstico
            console.log('Mensagem de erro original:', error.message.substring(0, 100));
          }
        }
        
        // Verificar se há um código de erro
        if (error.code) {
          console.log('Código de erro:', error.code);
        }
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
