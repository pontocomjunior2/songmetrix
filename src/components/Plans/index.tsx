import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IMaskInput } from 'react-imask';
import { PrimaryButton, SecondaryButton } from '../Common/Button';
import { CheckCircle, Star, Award, Zap, Clock, Shield, BarChart2, Users, Loader2, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase-client';
import { toast } from 'react-toastify';
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { cn } from '../../lib/utils';
import { Badge } from "../ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ErrorAlert } from '../Common/Alert';

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
  isSelected: boolean;
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
const PlanCard: React.FC<PlanCardProps> = ({ plan, onSubscribe, isLoading, isSelected }) => {
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
          {isLoading && isSelected ? <Loader2 className="h-5 w-5 animate-spin" /> : plan.buttonText}
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
  const [isCpfModalOpen, setIsCpfModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [cpfCnpjLoading, setCpfCnpjLoading] = useState(false);
  const [cpfCnpjError, setCpfCnpjError] = useState<string | null>(null);

  const message = location.state?.message || '';
  const isTrialExpired = location.state?.trialExpired || false;

  const handleSubscription = useCallback((planId: string) => {
    setError(null);
    setCpfCnpjError(null);
    setCpfCnpj('');

    if (!currentUser) {
        toast.error("Você precisa estar logado para assinar um plano.");
        navigate('/login');
        return;
    }
    
    setSelectedPlanId(planId);
    setIsCpfModalOpen(true);

  }, [currentUser, navigate]);

  const handleConfirmAndPay = useCallback(async () => {
    setCpfCnpjError(null);

    const cleanedCpfCnpj = cpfCnpj.replace(/\D/g, '');
    if (cleanedCpfCnpj.length !== 11 && cleanedCpfCnpj.length !== 14) {
        setCpfCnpjError('CPF/CNPJ inválido. Verifique os números.');
        return;
    }

    if (!selectedPlanId) {
        setCpfCnpjError('Erro interno: Plano não selecionado.');
        return;
    }

    setCpfCnpjLoading(true);
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
            throw new Error('Sessão inválida ou expirada. Faça login novamente.');
        }
        const token = sessionData.session.access_token;

        console.log(`Atualizando cliente com CPF/CNPJ: ${cleanedCpfCnpj}`);
        const updateResponse = await fetch('/api/customers/update-asaas', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ cpfCnpj: cleanedCpfCnpj })
        });

        const updateResult = await updateResponse.json();
        if (!updateResponse.ok) {
            throw new Error(updateResult.error || 'Falha ao atualizar dados do cliente no gateway.');
        }
        console.log('Dados do cliente atualizados no Asaas com sucesso.');

        console.log(`Criando cobrança para o plano: ${selectedPlanId}`);
        const chargeResponse = await fetch('/api/payments/create-charge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ planId: selectedPlanId })
        });

        const chargeResult = await chargeResponse.json();
        if (!chargeResponse.ok) {
            throw new Error(chargeResult.error || 'Falha ao criar cobrança no gateway de pagamento.');
        }

        if (chargeResult.invoiceUrl) {
            toast.success('Redirecionando para pagamento...');
            window.location.href = chargeResult.invoiceUrl;
        } else {
            throw new Error('URL de pagamento não recebida do gateway.');
        }

    } catch (err: any) {
        console.error("Erro no processo de confirmação e pagamento:", err);
        const errorMessage = err.message || 'Ocorreu um erro inesperado.';
        setCpfCnpjError(errorMessage);
        toast.error(`Erro: ${errorMessage}`);
        setCpfCnpjLoading(false);
    }

  }, [cpfCnpj, selectedPlanId, currentUser, navigate]);

  const inputClasses = cn(
      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      cpfCnpjError ? "border-red-500 focus-visible:ring-red-500" : ""
  );

  const isLoading = !!loadingPlan || cpfCnpjLoading;

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
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="flex-grow container mx-auto px-4 py-12 sm:px-6 lg:px-8">

        {(message || isTrialExpired) && (
           <Alert variant={isTrialExpired ? "destructive" : "default"} className="mb-8">
             <AlertCircle className="h-4 w-4" />
              <AlertTitle>{isTrialExpired ? "Período de Testes Expirado" : "Informação"}</AlertTitle>
              <AlertDescription>
                {message || "Seu período de testes gratuito de 14 dias terminou. Para continuar usando o Songmetrix, por favor, escolha um plano abaixo."}
              </AlertDescription>
            </Alert>
        )}

         <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
              Planos Flexíveis para sua Necessidade
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-gray-500 dark:text-gray-400 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              Escolha o plano que melhor se adapta ao tamanho e às ambições da sua estação.
            </p>
          </div>

          {error && (
            <ErrorAlert message={`Erro ao carregar planos ou processar pagamento: ${error}`} onClose={() => setError(null)} />
          )}

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {planDetails.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onSubscribe={handleSubscription}
                isLoading={isLoading}
                isSelected={isLoading && selectedPlanId === plan.id}
              />
            ))}
          </div>

          <section className="mt-20">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Funcionalidades Poderosas</h2>
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Tudo que você precisa para otimizar sua programação.</p>
            </div>
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
                {features.map((feature, index) => (
                  <div key={index} className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <div className="flex items-center justify-center h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900 mx-auto mb-4">
                        {feature.icon}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
                  </div>
                ))}
            </div>
          </section>

          <section className="mt-20 bg-gradient-to-r from-indigo-500 to-purple-600 py-16 rounded-lg shadow-xl">
            <div className="text-center mb-12 px-4">
                <h2 className="text-3xl font-extrabold text-white">O que Nossos Clientes Dizem</h2>
                <p className="mt-4 text-lg text-indigo-100">Resultados reais de rádios como a sua.</p>
            </div>
            <div className="grid grid-cols-1 gap-12 md:grid-cols-2 max-w-4xl mx-auto px-4">
                {testimonials.map((testimonial, index) => (
                  <blockquote key={index} className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                    <p className="text-base text-gray-700 dark:text-gray-300 italic mb-4">"{testimonial.quote}"</p>
                    <footer className="text-sm">
                        <p className="font-semibold text-gray-900 dark:text-white">{testimonial.author}</p>
                        <p className="text-gray-500 dark:text-gray-400">{testimonial.role}</p>
                    </footer>
                  </blockquote>
                ))}
            </div>
          </section>

          <section className="mt-20 max-w-3xl mx-auto">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Perguntas Frequentes</h2>
            </div>
            <div className="space-y-6">
                {faqs.map((faq, index) => (
                  <details key={index} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm group">
                    <summary className="flex justify-between items-center cursor-pointer font-medium text-gray-900 dark:text-white">
                        {faq.question}
                        <svg className="h-5 w-5 text-gray-500 group-open:rotate-180 transition-transform" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{faq.answer}</p>
                  </details>
                ))}
            </div>
          </section>

      </main>

      <Dialog open={isCpfModalOpen} onOpenChange={setIsCpfModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmação de Dados</DialogTitle>
            <DialogDescription>
              Para prosseguir com a assinatura, precisamos do seu CPF ou CNPJ.
              Estes dados são necessários para a emissão da cobrança.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {cpfCnpjError && (
              <ErrorAlert message={cpfCnpjError} onClose={() => setCpfCnpjError(null)} />
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cpfCnpj" className="text-right">
                CPF/CNPJ
              </Label>
              <IMaskInput
                mask={[
                  { mask: '000.000.000-00' },
                  { mask: '00.000.000/0000-00' }
                ]}
                radix="."
                unmask={true}
                onAccept={(value) => setCpfCnpj(value as string)}
                id="cpfCnpj"
                placeholder="Seu CPF ou CNPJ"
                required
                className={cn(inputClasses, "col-span-3")}
              />
            </div>
          </div>
          <DialogFooter>
             <SecondaryButton 
                 type="button" 
                 disabled={cpfCnpjLoading}
                 onClick={() => setIsCpfModalOpen(false)}
             >
                    Cancelar
                </SecondaryButton>
            <PrimaryButton onClick={handleConfirmAndPay} disabled={cpfCnpjLoading}>
              {cpfCnpjLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar e Continuar
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}