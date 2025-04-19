import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PrimaryButton } from '../Common/Button';
import { CheckCircle, Star, Award, Zap, Clock, Shield, BarChart2, Users, Loader2, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase-client';
import { toast } from 'react-toastify';
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { cn } from '../../lib/utils';
import { Badge } from "../ui/badge";

// --- Interfaces --- (Definir tipos)

interface PlanFeature {
  // Se features for um array de objetos, definir aqui
}

interface Plan {
  id: string;
  title: string;
  price: number;
  priceSuffix: string;
  description: string;
  features: string[]; // Ou PlanFeature[]
  buttonText: string;
  monthlyEquivalent?: number;
  popular?: boolean;
  savingsText?: string;
}

interface PlanCardProps {
  plan: Plan;
  onSubscribe: (planId: string) => void;
  isLoading: boolean;
}

// Estrutura dos planos
const planDetails: Plan[] = [
  {
    id: 'mensal',
    title: 'Mensal',
    price: 1299.00,
    priceSuffix: '/mês',
    description: 'Acesso completo por 1 mês.',
    features: [
      "Ideal para experimentar",
      "Flexibilidade total",
      "Cancele quando quiser"
    ],
    buttonText: 'Assinar Mensal'
  },
  {
    id: 'semestral',
    title: 'Semestral',
    price: 5394.00,
    monthlyEquivalent: 899.00,
    priceSuffix: '/mês',
    description: 'Economia significativa para 6 meses.',
    features: [
      "Todas as funcionalidades",
      "Suporte prioritário"
    ],
    buttonText: 'Assinar Semestral',
    savingsText: 'Economize 30%'
  },
  {
    id: 'anual',
    title: 'Anual',
    price: 8994.00,
    monthlyEquivalent: 749.50,
    priceSuffix: '/mês',
    description: 'O melhor valor para acesso completo por 1 ano.',
    features: [
      "Todas as funcionalidades",
      "Suporte prioritário",
      "Acesso antecipado a novos recursos"
    ],
    buttonText: 'Assinar Anual',
    popular: true,
    savingsText: 'Economize 42%'
  }
];

// Componente Card do Plano (Recomendado criar em arquivo separado depois)
const PlanCard: React.FC<PlanCardProps> = ({ plan, onSubscribe, isLoading }) => {
  const formatPrice = (price: number): string => {
    return price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const displayPrice = plan.monthlyEquivalent ?? plan.price;

  return (
    <div
      className={cn(
        "relative border rounded-xl p-6 flex flex-col bg-white dark:bg-gray-800 shadow-sm hover:shadow-lg transition-shadow duration-200",
         plan.popular ? 'border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700' : 'border-gray-300 dark:border-gray-700'
      )}
    >
      <div className="absolute top-0 left-6 -translate-y-1/2 flex gap-2">
        {plan.popular && (
          <Badge variant="default" className="bg-indigo-500 hover:bg-indigo-600 text-white">
            Mais Popular
          </Badge>
        )}
         {plan.savingsText && (
          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
            {plan.savingsText}
          </Badge>
        )}
      </div>

      <div className="pt-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{plan.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 h-10">{plan.description}</p>

        <div className="mb-6">
          <span className="text-4xl font-extrabold text-gray-900 dark:text-white">R$ {formatPrice(displayPrice)}</span>
          <span className="text-lg font-medium text-gray-500 dark:text-gray-400">{plan.priceSuffix}</span>

          {plan.monthlyEquivalent && (
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
               Cobrado R$ {formatPrice(plan.price)} {plan.id === 'semestral' ? 'semestralmente' : 'anualmente'}
             </p>
          )}
        </div>

        <ul className="space-y-2 mb-8 flex-grow">
          {plan.features.map((feature: string, index: number) => (
            <li key={index} className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mr-2 mt-0.5" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
            </li>
          ))}
        </ul>

        <PrimaryButton
          onClick={() => onSubscribe(plan.id)}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : plan.buttonText}
        </PrimaryButton>
      </div>
    </div>
  );
};

export default function Plans() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const message = location.state?.message || '';
  const isTrialExpired = location.state?.trialExpired || false;

  const handleSubscription = useCallback(async (planId: string) => {
    setError(null);
    if (!currentUser) {
        toast.error("Você precisa estar logado para assinar um plano.");
        navigate('/login');
        return;
    }
    
    setLoadingPlan(planId);
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
            throw new Error('Sessão inválida ou expirada. Faça login novamente.');
        }
        const token = sessionData.session.access_token;

        const response = await fetch('/api/payments/create-charge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ planId })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Falha ao iniciar o processo de pagamento.');
        }

        if (result.invoiceUrl) {
            // Redirecionar para a página de pagamento do Asaas
            window.location.href = result.invoiceUrl;
        } else {
            throw new Error('URL de pagamento não recebida.');
        }

    } catch (err: any) {
        console.error("Erro ao criar cobrança:", err);
        const errorMessage = err.message || 'Ocorreu um erro inesperado.';
        setError(errorMessage);
        toast.error(`Erro: ${errorMessage}`);
    } finally {
        setLoadingPlan(null);
    }
  }, [currentUser, navigate]);

  const features = [
    {
      icon: <BarChart2 className="h-12 w-12 text-indigo-500" />,
      title: "Monitoramento em Tempo Real",
      description: "Acompanhe a programação musical das principais rádios brasileiras com atualizações instantâneas."
    },
    {
      icon: <Zap className="h-12 w-12 text-yellow-500" />,
      title: "Insights Estratégicos",
      description: "Descubra tendências e padrões musicais com nossa análise detalhada de dados."
    },
    {
      icon: <Users className="h-12 w-12 text-blue-500" />,
      title: "Análise de Concorrência",
      description: "Compare sua programação com a de outras rádios e identifique oportunidades estratégicas."
    },
    {
      icon: <Shield className="h-12 w-12 text-green-500" />,
      title: "Suporte Especializado",
      description: "Nossa equipe de especialistas está disponível para ajudar você a otimizar sua programação musical."
    }
  ];

  const testimonials = [
    {
      quote: "O Songmetrix revolucionou a forma como programamos nossa rádio. Conseguimos aumentar nossa audiência em 30% em apenas 3 meses.",
      author: "Carlos Silva",
      role: "Diretor de Programação, Rádio Top FM"
    },
    {
      quote: "A análise de concorrência nos permitiu identificar oportunidades que não víamos antes. Ferramenta indispensável para qualquer rádio.",
      author: "Ana Martins",
      role: "Gerente de Conteúdo, Rádio Cidade"
    }
  ];

  const faqs = [
    {
      question: "Como o Songmetrix pode ajudar minha rádio?",
      answer: "O Songmetrix fornece dados em tempo real sobre execuções musicais, permitindo que você tome decisões estratégicas sobre sua programação, acompanhe tendências e se destaque da concorrência."
    },
    {
      question: "Por quanto tempo o desconto promocional estará disponível?",
      answer: "O desconto de lançamento de 75% é por tempo limitado. Recomendamos que você aproveite esta oportunidade o quanto antes para garantir o melhor preço."
    },
    {
      question: "Posso cancelar minha assinatura a qualquer momento?",
      answer: "Sim, você pode cancelar sua assinatura quando quiser. Não há taxas de cancelamento ou contratos de longo prazo obrigatórios."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto text-center">
        <div className="mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6">
             Escolha o Plano Ideal para sua Rádio
          </h1>
          <p className="mt-3 max-w-3xl mx-auto text-xl text-gray-600 dark:text-gray-300">
            Potencialize sua programação com insights e dados precisos.
          </p>
          
          {/* Mensagens de Estado (Trial Expirado, Erro, etc.) */}
          {isTrialExpired && (
             <Alert variant="destructive" className="mt-8 max-w-3xl mx-auto text-left">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Período de Teste Expirado</AlertTitle>
                <AlertDescription>
                   Seu período de avaliação gratuito terminou. Escolha um plano abaixo para continuar utilizando todos os recursos do Songmetrix.
                </AlertDescription>
             </Alert>
          )}
          {error && (
             <Alert variant="destructive" className="mt-8 max-w-3xl mx-auto text-left">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro ao Processar</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
             </Alert>
          )}
           {message && (
             <Alert variant="default" className="mt-8 max-w-3xl mx-auto text-left border-blue-500 bg-blue-50 dark:bg-blue-900/30">
                 <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                 <AlertTitle className="text-blue-800 dark:text-blue-300">Informação</AlertTitle>
                 <AlertDescription className="text-blue-700 dark:text-blue-400">{message}</AlertDescription>
             </Alert>
          )}
        </div>
      </div>

      {/* Nova Seção de Planos */}
      <div className="max-w-7xl mx-auto mb-20">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 items-stretch">
          {planDetails.map((plan) => (
            <PlanCard 
              key={plan.id} 
              plan={plan} 
              onSubscribe={handleSubscription} 
              isLoading={loadingPlan === plan.id}
            />
          ))}
        </div>
      </div>

      {/* Manter Recursos, Depoimentos, FAQs se desejar */}
      {/* ... Seção Recursos ... */}
      {/* ... Seção Depoimentos ... */}
      {/* ... Seção FAQs ... */} 
      
    </div>
  );
}