import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EmailInput, PasswordInput } from '../Common/Input';
import { PrimaryButton } from '../Common/Button';
import { ErrorAlert } from '../Common/Alert';
import Loading from '../Common/Loading';
import { supabase } from '../../lib/supabase-client';
import Input from '../Common/Input';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
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

    if (!fullName.trim()) {
      return setError('O Nome Completo é obrigatório');
    }

    if (!whatsapp.trim()) {
      return setError('O WhatsApp é obrigatório');
    }

    try {
      setError('');
      setLoading(true);

      // Usar a função signUp do AuthContext
      const { error: signUpError, message } = await signUp(email, password, fullName, whatsapp);

      if (signUpError) throw signUpError;

      // O registro na tabela users já foi criado pelo AuthContext.signUp
      
      try {
        // Atualizar os metadados do usuário explicitamente para garantir o status TRIAL
        const { error: updateError } = await supabase.auth.updateUser({
          data: { status: 'TRIAL' }
        });
        
        if (updateError) {
          console.error('Erro ao atualizar metadados do usuário:', updateError);
          // Continuar mesmo com erro, pois o usuário foi criado
        }
      } catch (metadataError) {
        console.error('Erro ao atualizar metadados:', metadataError);
        // Continuar mesmo com erro
      }
      
      // Não fazer logout após o cadastro, isso interrompe o fluxo
      // O usuário será direcionado para confirmar o email e então fazer login

      // Personalizar a mensagem se fornecida
      const customMessage = message || 'Por favor, verifique seu email para confirmar seu cadastro. Após a confirmação, você terá acesso ao sistema com 14 dias gratuitos para testar todas as funcionalidades. Se não encontrar o email, verifique sua caixa de spam.';
      
      setLoading(false); // Desativar o loading antes de navegar
      
      console.log('Redirecionando para pending-approval após cadastro bem-sucedido');
      
      // Navigate to pending-approval imediatamente
      navigate('/pending-approval', { 
        state: { 
          message: customMessage 
        },
        replace: true  // Isso garante que o usuário não possa voltar para a página anterior
      });
      
      console.log(`Redirecionamento executado para: /pending-approval`);
      
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
      setLoading(false);
    }
  };

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
              <p>Ao se cadastrar, você terá 14 dias gratuitos para testar todas as funcionalidades do sistema.</p>
            </div>
          </div>

          {error && (
            <ErrorAlert message={error} onClose={() => setError('')} />
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome Completo"
                icon={
                  <svg
                    className="h-5 w-5 text-gray-400 group-focus-within:text-[#1a3891] transition-colors"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                }
                required
              />
            </div>
            <div>
              <Input
                id="whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="WhatsApp"
                icon={
                  <svg
                    className="h-5 w-5 text-gray-400 group-focus-within:text-[#1a3891] transition-colors"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                }
                required
              />
            </div>
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
