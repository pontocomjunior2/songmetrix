import React from 'react';
import { useAuth } from '../hooks/useAuth';
import Loading from '../components/Common/Loading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MeuPlanoPage() {
  const { planId, currentUser, trialEndsAt, loading, isInitialized } = useAuth();

  // REMOVIDO: Dados de exemplo não são mais necessários aqui
  // const subscriptionDetails = { ... };

  const isLoading = loading || !isInitialized;

  const renderPlanInfo = () => {
    if (isLoading) {
      return <Loading />;
    }

    switch (planId?.toUpperCase()) {
      case 'TRIAL':
        return (
          <>
            <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Teste</Badge>
            <p className="mt-4 text-gray-700 dark:text-gray-300">
              Seu período de teste gratuito está ativo.
              {trialEndsAt && (
                <span> Termina em {format(new Date(trialEndsAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.</span>
              )}
            </p>
            <Button asChild className="mt-6">
              <Link to="/plans">Ver Planos de Assinatura</Link>
            </Button>
          </>
        );
      case 'FREE':
        return (
          <>
            <Badge variant="secondary">Gratuito</Badge>
            <p className="mt-4 text-gray-700 dark:text-gray-300">
              Você está utilizando o plano gratuito da SongMetrix.
            </p>
            <Button asChild className="mt-6">
              <Link to="/plans">Ver Planos de Assinatura</Link>
            </Button>
          </>
        );
      case 'ATIVO':
        return (
          <>
            <Badge variant="outline" className="border-green-500 text-green-700 dark:border-green-400 dark:text-green-300">Ativo</Badge>
            <div className="mt-4 space-y-2 text-gray-700 dark:text-gray-300">
              <p>Sua assinatura da SongMetrix está ativa.</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Detalhes específicos como valor e data de renovação são gerenciados através do nosso parceiro de pagamentos.
              </p>
            </div>
            <Button className="mt-6" disabled>Gerenciar Assinatura (Em breve)</Button>
          </>
        );
      case 'ADMIN':
        return (
          <>
            <Badge variant="destructive">Administrador</Badge>
            <p className="mt-4 text-gray-700 dark:text-gray-300">
              Você possui acesso total de administrador. Nenhuma assinatura é necessária.
            </p>
          </>
        );
       case 'INATIVO':
         return (
          <>
            <Badge variant="outline">Inativo</Badge>
            <p className="mt-4 text-gray-700 dark:text-gray-300">
              Seu plano está inativo. Para reativar, escolha um plano.
            </p>
            <Button asChild className="mt-6">
              <Link to="/plans">Ver Planos de Assinatura</Link>
            </Button>
          </>
        );
      default:
        return (
          <p className="mt-4 text-red-600 dark:text-red-400">
            Não foi possível identificar seu plano ({planId || 'desconhecido'}). Entre em contato com o suporte.
          </p>
        );
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Meu Plano</CardTitle>
          <CardDescription>
            Informações sobre sua assinatura atual da SongMetrix.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderPlanInfo()}
        </CardContent>
      </Card>
    </div>
  );
} 