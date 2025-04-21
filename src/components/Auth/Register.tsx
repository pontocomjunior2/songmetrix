import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IMaskInput } from 'react-imask';
import { useAuth } from '../../hooks/useAuth';
import { EmailInput, PasswordInput } from '../Common/Input';
import { PrimaryButton } from '../Common/Button';
import { ErrorAlert } from '../Common/Alert';
import Loading from '../Common/Loading';
import { supabase } from '../../lib/supabase-client';

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

  // Função para verificar a configuração do projeto no Supabase
  const checkSupabaseConfig = async () => {
    try {
      const { data: configData, error: configError } = await supabase.functions.invoke('get-site-config', {
        body: { check: 'redirect_url' }
      });
      
      if (configError) {
        console.error('Erro ao verificar configuração do Supabase:', configError);
        return;
      }
      
      console.log('Configuração do site no Supabase:', configData);
    } catch (error) {
      console.error('Erro ao chamar função Edge:', error);
    }
  };

  // Verificar configuração ao montar o componente
  useEffect(() => {
    checkSupabaseConfig().catch(console.error);
  }, []);

  const validatePassword = (password: string): boolean => {
    // Pelo menos 6 caracteres, 1 caractere especial e 1 letra maiúscula
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{6,})/;
    return passwordRegex.test(password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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

    const whatsappDigits = whatsapp.replace(/\D/g, '');
    if (!whatsappDigits || (whatsappDigits.length !== 10 && whatsappDigits.length !== 11)) {
        return setError('O WhatsApp deve conter 10 ou 11 números (incluindo DDD)');
    }

    try {
      setLoading(true);
      console.log('Iniciando processo de cadastro de usuário...');
      console.log('Email:', email);
      console.log('WhatsApp (dígitos):', whatsappDigits);
      console.log('URL de redirecionamento configurada para:', 'https://songmetrix.com.br/login');

      const { error: signUpError, message } = await signUp(email, password, fullName, whatsappDigits);

      if (signUpError) throw signUpError;

      console.log('Cadastro realizado com sucesso no Supabase. Usuário receberá email com link para https://songmetrix.com.br/login');

      const customMessage = message || 'Por favor, verifique seu email para confirmar seu cadastro. Após a confirmação, você terá acesso ao sistema com 14 dias gratuitos para testar todas as funcionalidades. Se não encontrar o email, verifique sua caixa de spam.';
      
      setLoading(false);
      
      console.log('Redirecionando para pending-approval após cadastro bem-sucedido');
      
      navigate('/pending-approval', { 
        state: { 
          message: customMessage 
        },
        replace: true
      });
      
      console.log(`Redirecionamento executado para: /pending-approval`);
      
    } catch (error: any) {
      console.error('Erro no registro:', error);
      let errorMessage = 'Falha ao criar conta. Por favor, tente novamente.';

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
          
          if (errorMessage === 'Falha ao criar conta. Por favor, tente novamente.') {
            console.log('Mensagem de erro original:', error.message.substring(0, 100));
          }
        }
        
        if (error.code) {
          console.log('Código de erro:', error.code);
        }
      }

      setError(errorMessage);
      setLoading(false);
    }
  };

  const whatsappIcon = (
      <svg
        className="h-5 w-5 text-gray-400 group-focus-within:text-[#1a3891] transition-colors"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
      </svg>
  );

  const inputBaseClasses = `
    appearance-none block w-full px-3 py-2
    border rounded-lg
    placeholder-gray-400 dark:placeholder-gray-500
    focus:outline-none focus:ring-2 focus:ring-[#1a3891] focus:border-[#1a3891]
    transition-colors
    sm:text-sm
    border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white
  `;
  const inputIconClass = 'pl-10';

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

          {loading && <Loading />}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <div className="relative rounded-lg group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400 group-focus-within:text-[#1a3891] transition-colors"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nome Completo"
                  className={`${inputBaseClasses} ${inputIconClass}`}
                  required
                />
              </div>
            </div>
            <div>
              <div className="relative rounded-lg group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {whatsappIcon}
                </div>
                <IMaskInput
                  mask={[
                    { mask: '(00) 0000-0000' },
                    { mask: '(00) 00000-0000' }
                  ]}
                  radix="."
                  unmask={true}
                  onAccept={(value) => setWhatsapp(value as string)}
                  id="whatsapp"
                  placeholder="WhatsApp (DDD + Número)"
                  required
                  className={`${inputBaseClasses} ${inputIconClass}`}
                />
              </div>
            </div>
            <div>
              <EmailInput
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
              />
            </div>
            <div>
              <PasswordInput
                id="password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                required
              />
            </div>
            <div>
              <PasswordInput
                id="confirmPassword"
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar Senha"
                required
              />
            </div>

            <div className="pt-2">
              <PrimaryButton type="submit" disabled={loading} className="w-full">
                {loading ? <Loading size="small" /> : 'Criar Conta'}
              </PrimaryButton>
            </div>
            <div className="text-sm text-center">
              <p className="text-gray-600">
                Já tem uma conta?{' '}
                <Link to="/login" className="font-medium text-[#1a3891] hover:text-[#122463]">
                  Entrar
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
