import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EmailInput, PasswordInput } from '../Common/Input';
import { PrimaryButton } from '../Common/Button';
import { ErrorAlert } from '../Common/Alert';
import Loading from '../Common/Loading';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUpWithEmail, redirectToStripeCheckout } = useAuth();
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
      await signUpWithEmail(email, password);
      await redirectToStripeCheckout();
    } catch (error) {
      console.error('Erro no registro:', error);
      setError('Falha ao criar conta. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading size="large" message="Criando sua conta..." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <img
            className="mx-auto h-12 w-auto"
            src="/logo.svg"
            alt="SongMetrix"
          />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Criar nova conta
          </h2>
        </div>

        {error && (
          <ErrorAlert message={error} onClose={() => setError('')} />
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="mb-4">
              <EmailInput
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
              />
            </div>
            <div className="mb-4">
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
            className="font-medium text-blue-600 hover:text-blue-500"
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
  );
}
