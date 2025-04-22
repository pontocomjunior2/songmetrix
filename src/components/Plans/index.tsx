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

// Estrutura dos planos ATUALIZADA com cycle, price total e description para API
const planDetails: Plan[] = [
  {
    id: 'mensal',
    title: 'Mensal',
    price: 1299.00, // Valor total do período (1 mês)
    priceSuffix: '/mês',
    description: 'Assinatura Songmetrix - Plano Mensal', // Descrição para Asaas
    features: [
      "Ideal para experimentar",
      "Flexibilidade total",
      "Cancele quando quiser"
    ],
    buttonText: 'Assinar Mensal',
    // cycle: 'MONTHLY' // Adicionar cycle
  },
  {
    id: 'semestral',
    title: 'Semestral',
    price: 5394.00, // Valor TOTAL para 6 meses (899.00 * 6)
    monthlyEquivalent: 899.00,
    priceSuffix: '/mês',
    description: 'Assinatura Songmetrix - Plano Semestral', // Descrição para Asaas
    features: [
      "Todas as funcionalidades",
      "Suporte prioritário"
    ],
    buttonText: 'Assinar Semestral',
    savingsText: 'Economize 30%',
    // cycle: 'SEMIANNUALLY' // Adicionar cycle
  },
  {
    id: 'anual',
    title: 'Anual',
    price: 8994.00, // Valor TOTAL para 12 meses (749.50 * 12)
    monthlyEquivalent: 749.50,
    priceSuffix: '/mês',
    description: 'Assinatura Songmetrix - Plano Anual', // Descrição para Asaas
    features: [
      "Todas as funcionalidades",
      "Suporte prioritário",
      "Acesso antecipado a novos recursos"
    ],
    buttonText: 'Assinar Anual',
    popular: true,
    savingsText: 'Economize 42%',
    // cycle: 'YEARLY' // Adicionar cycle
  }
];

// --- ADICIONAR TYPE com cycle para os planos ---
interface PlanWithCycle extends Plan {
    cycle: 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';
}

// Atualizar a definição de planDetails para usar o novo tipo
const planDetailsTyped: PlanWithCycle[] = [
    {
      id: 'mensal',
      title: 'Mensal',
      price: 1299.00,
      priceSuffix: '/mês',
      description: 'Acesso completo e flexível aos insights da plataforma.',
      features: [
        "Acesso completo a todas as funcionalidades",
        "Visualize todas as rádios monitoradas",
        "Relatórios detalhados com filtros ilimitados",
        "Cancele quando quiser"
      ],
      buttonText: 'Assinar Agora',
      cycle: 'MONTHLY'
    },
    // REMOVER OS PLANOS SEMESTRAL E ANUAL DAQUI
    // {
    //   id: 'semestral',
    //   title: 'Semestral',
    //   price: 5394.00,
    //   monthlyEquivalent: 899.00,
    //   priceSuffix: '/mês',
    //   description: 'Assinatura Songmetrix - Plano Semestral',
    //   features: [
    //     "Todas as funcionalidades",
    //     "Suporte prioritário"
    //   ],
    //   buttonText: 'Assinar Semestral',
    //   savingsText: 'Economize 30%',
    //   cycle: 'SEMIANNUALLY'
    // },
    // {
    //   id: 'anual',
    //   title: 'Anual',
    //   price: 8994.00,
    //   monthlyEquivalent: 749.50,
    //   priceSuffix: '/mês',
    //   description: 'Assinatura Songmetrix - Plano Anual',
    //   features: [
    //     "Todas as funcionalidades",
    //     "Suporte prioritário",
    //     "Acesso antecipado a novos recursos"
    //   ],
    //   buttonText: 'Assinar Anual',
    //   popular: true,
    //   savingsText: 'Economize 42%',
    //   cycle: 'YEARLY'
    // }
];

// Isolar o plano mensal para uso direto
const mensalPlan = planDetailsTyped[0];

// Componente Card do Plano (Recomendado criar em arquivo separado depois)
// const PlanCard: React.FC<PlanCardProps> = ({ plan, onSubscribe, isLoading, isSelected }) => {
//   // ... (código do PlanCard removido para simplificação)
// };

export default function Plans() {
  console.log('DEBUG: import.meta.env:', import.meta.env);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, loading: authLoading } = useAuth(); // Adicionar authLoading
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null); // Manter para o botão
  const [error, setError] = useState<string | null>(null);
  const [isCpfModalOpen, setIsCpfModalOpen] = useState(false);
  // const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null); // Não precisa mais selecionar
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [cpfCnpjLoading, setCpfCnpjLoading] = useState(false);
  const [cpfCnpjError, setCpfCnpjError] = useState<string | null>(null);

  // Remover states de cartão, pois o pagamento será via Asaas (Boleto/Pix/Invoice)
  // const [cardName, setCardName] = useState('');
  // const [cardNumber, setCardNumber] = useState('');
  // const [cardExpiry, setCardExpiry] = useState('');
  // const [cardCvc, setCardCvc] = useState('');
  // const [cardError, setCardError] = useState<string | null>(null);

  const message = location.state?.message || '';
  const isTrialExpired = location.state?.trialExpired || false;

  // Simplificar handleSubscription para sempre usar o plano mensal
  const handleSubscription = useCallback(() => {
    setError(null);
    setCpfCnpjError(null);
    setCpfCnpj(''); // Limpar CPF/CNPJ ao abrir modal

    if (!currentUser) {
      toast.error("Você precisa estar logado para assinar um plano.");
      navigate('/login', { state: { from: location } });
      return;
    }

    console.log('Verificando CPF/CNPJ do usuário...', currentUser.user_metadata?.cpf_cnpj);

    // Verificar se o usuário JÁ TEM CPF/CNPJ cadastrado no Supabase
    if (currentUser.user_metadata?.cpf_cnpj) {
      console.log('Usuário já possui CPF/CNPJ. Iniciando pagamento...');
      handleConfirmAndPay(currentUser.user_metadata.cpf_cnpj); // Chamar diretamente o pagamento
    } else {
      console.log('Usuário não possui CPF/CNPJ. Abrindo modal...');
      // Se não tiver CPF/CNPJ, abrir o modal para coletar
      setIsCpfModalOpen(true);
    }
  }, [currentUser, navigate, location]);

  // Função para formatar preço
  const formatPrice = (price: number): string => {
    return price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleCpfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpfCnpjLoading(true);
    setCpfCnpjError(null);
    setError(null);
    const rawCpfCnpj = cpfCnpj.replace(/\D/g, ''); // Remove non-digit characters

    // Validação simples (pode melhorar com libs)
    if (!rawCpfCnpj || (rawCpfCnpj.length !== 11 && rawCpfCnpj.length !== 14)) {
        setCpfCnpjError('CPF/CNPJ inválido. Verifique o número digitado.');
        setCpfCnpjLoading(false);
        return;
    }

    try {
      console.log('Atualizando CPF/CNPJ via backend...');
      // Atualizar o CPF/CNPJ no Supabase ANTES de criar a assinatura
      const { error: updateError } = await supabase.auth.updateUser({
          data: { cpf_cnpj: rawCpfCnpj }
      });

      if (updateError) {
          console.error('Erro ao atualizar CPF/CNPJ no Supabase:', updateError);
          setCpfCnpjError(`Erro ao salvar CPF/CNPJ: ${updateError.message}. Tente novamente.`);
          throw updateError;
      }

      console.log('CPF/CNPJ atualizado com sucesso (via backend).');
      toast.success('CPF/CNPJ salvo com sucesso!');
      setIsCpfModalOpen(false); // Fechar modal APÓS sucesso

      // Após atualizar, chamar handleConfirmAndPay com o novo CPF/CNPJ
      await handleConfirmAndPay(rawCpfCnpj);

    } catch (error) {
        console.error("Erro ao atualizar CPF/CNPJ ou criar pagamento:", error);
        // Erro já tratado no bloco do update ou no handleConfirmAndPay
        // Se o erro for no update, CpfCnpjError será setado.
        // Se o erro for no handleConfirmAndPay, setError será setado.
        if (!cpfCnpjError && !error) { // Fallback
           setError('Ocorreu um erro inesperado. Tente novamente.');
        }
    } finally {
        setCpfCnpjLoading(false);
    }
  };

  // Função principal para criar a assinatura no Asaas
  const handleConfirmAndPay = useCallback(async (customerCpfCnpj: string) => {
    // Garantir que o modal seja fechado se ainda estiver aberto
    setIsCpfModalOpen(false);
    setLoadingPlan(mensalPlan.id); // Indicar carregamento no botão
    setError(null);
    setCpfCnpjError(null);

    if (!currentUser) {
      setError("Usuário não autenticado.");
      setLoadingPlan(null);
      return;
    }

    const rawCpfCnpj = customerCpfCnpj.replace(/\D/g, '');

    // Usar os detalhes do plano mensal diretamente
    const selectedPlan = mensalPlan;

    try {
      console.log('Criando assinatura no Asaas...');

      // Obter token da sessão atual
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error(sessionError?.message || 'Sessão inválida ou expirada. Faça login novamente.');
      }
      const supabaseToken = sessionData.session.access_token;

      const response = await fetch('/api/payments/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseToken}`,
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          cpfCnpj: rawCpfCnpj,
          cycle: selectedPlan.cycle,
          price: selectedPlan.price,
          description: selectedPlan.description,
          billingType: 'UNDEFINED',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Erro da API ao criar assinatura:', result);
        setError(result.message || 'Falha ao iniciar o processo de assinatura. Tente novamente.');
        throw new Error(result.message || 'Erro na API');
      }

      console.log('Assinatura criada/recuperada:', result);
      const subscriptionData = result.data || result; // Ajustar conforme a estrutura da sua API
      const firstPayment = subscriptionData.firstPayment;

      // Priorizar invoiceUrl para UNDEFINED
      let paymentUrl = firstPayment?.invoiceUrl || subscriptionData?.invoiceUrl;

      if (paymentUrl) {
        console.log('Redirecionando para a URL da fatura:', paymentUrl);
        toast.success('Redirecionando para pagamento...');
        window.location.href = paymentUrl;
      } else {
        console.error('Não foi possível obter a URL de pagamento da fatura.', result);
        setError('Não foi possível obter o link de pagamento. Tente novamente ou contate o suporte.');
      }

    } catch (err: any) {
      console.error("Erro detalhado no handleConfirmAndPay:", err);
      if (!error) { // Evitar sobrescrever erro da API
          setError(err.message || 'Ocorreu um erro ao processar o pagamento. Tente novamente.');
      }
    } finally {
      setLoadingPlan(null);
    }
  }, [currentUser]); // Remover dependências desnecessárias

  // -------- REINTRODUZIR CONSTANTES DE DADOS --------
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
  // -------- FIM DAS CONSTANTES DE DADOS --------

  // -------- JSX Atualizado --------

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto"> {/* Aumentar max-w para acomodar o conteúdo */}
        <h2 className="text-3xl font-extrabold text-center text-gray-900 dark:text-white sm:text-4xl mb-4">
          Plano de Assinatura Songmetrix
        </h2>
        <p className="text-xl text-center text-gray-600 dark:text-gray-300 mb-10">
          Acesso completo à plataforma com flexibilidade total.
        </p>

        {message && (
          <Alert variant={isTrialExpired ? "destructive" : "default"} className="mb-8 bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300">
            <Info className="h-4 w-4" />
            <AlertTitle>{isTrialExpired ? "Período de Testes Encerrado" : "Informação"}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {error && (
             <ErrorAlert message={error} />
        )}

        {/* Renderizar APENAS o card do plano mensal */}
        <div className="flex justify-center mb-16"> 
          <div
            className={cn(
              "w-full max-w-md border rounded-xl flex flex-col bg-white dark:bg-gray-800 shadow-lg transition-shadow duration-200 overflow-hidden", // Adicionado overflow-hidden
               'border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700'
            )}
          >
             {/* Remover padding top daqui para aplicar seções separadas */}
            <div> 
              {/* 1. Título - com padding interno */}
              <div className="p-6 sm:p-8 pb-4"> {/* Ajustar padding */}
                 <h3 className="text-2xl font-semibold text-center text-gray-900 dark:text-white">{mensalPlan.title}</h3>
              </div>
              
              {/* 2. Preço Box - com fundo e padding */}
              <div className="bg-gray-50 dark:bg-gray-700/50 px-6 sm:px-8 py-4"> {/* Fundo e padding */}
                <div className="text-center"> 
                    <span className="text-5xl font-extrabold text-gray-900 dark:text-white">R$ {formatPrice(mensalPlan.price)}</span>
                    <span className="text-lg font-medium text-gray-500 dark:text-gray-400">{mensalPlan.priceSuffix}</span>
                </div>
              </div>

              {/* 3. Descrição e Features - com padding interno */}
               <div className="p-6 sm:p-8 flex flex-col flex-grow"> {/* Padding e flex-grow */}
                  <p className="text-sm text-center text-gray-600 dark:text-gray-400 mb-6">{mensalPlan.description}</p> 
    
                  {/* Divisor Sutil */}
                  <hr className="border-gray-200 dark:border-gray-700 my-6" />
    
                  {/* 4. Features */}
                  <ul className="space-y-3 mb-8 flex-grow"> {/* Remover flex-grow daqui se não for mais necessário */}
                    {mensalPlan.features.map((feature: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mr-3 mt-0.5" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span> {/* Ajustar tamanho da fonte se necessário */}
                      </li>
                    ))}
                  </ul>
    
                  {/* 5. Botão - Mantido no final */}
                   <div className="mt-auto"> {/* Empurrar botão para baixo */}
                       <PrimaryButton
                         onClick={handleSubscription} 
                         disabled={loadingPlan === mensalPlan.id || cpfCnpjLoading}
                         className="w-full text-lg py-3"
                       >
                         {(loadingPlan === mensalPlan.id || cpfCnpjLoading) ? <Loader2 className="h-6 w-6 animate-spin" /> : mensalPlan.buttonText}
                       </PrimaryButton>
                   </div>
               </div> 
            </div>
          </div>
        </div>

        {/* ----- REINTRODUZIR SEÇÕES ADICIONAIS ----- */}

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

           <section className="mt-20 mb-12 max-w-3xl mx-auto"> {/* Adicionar margem inferior */}
             <div className="text-center mb-12">
                 <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Perguntas Frequentes</h2>
             </div>
             <div className="space-y-6">
                 {faqs.map((faq, index) => (
                   <details key={index} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm group">
                     <summary className="flex justify-between items-center cursor-pointer font-medium text-gray-900 dark:text-white">
                         {faq.question}
                         {/* Substituir SVG por componente Lucide ChevronDown */}
                         <svg className="h-5 w-5 text-gray-500 group-open:rotate-180 transition-transform" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                         </svg>
                     </summary>
                     <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{faq.answer}</p>
                   </details>
                 ))}
             </div>
           </section>

        {/* ----- FIM DAS SEÇÕES ADICIONAIS ----- */}

        {/* Modal para CPF/CNPJ */}
        <Dialog open={isCpfModalOpen} onOpenChange={setIsCpfModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Confirme seu CPF ou CNPJ</DialogTitle>
                    <DialogDescription>
                        Precisamos do seu CPF ou CNPJ para gerar a cobrança da assinatura.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCpfSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="cpfCnpj" className="text-right">
                                CPF/CNPJ
                            </Label>
                            {/* Usar IMaskInput para formatar */}
                            <IMaskInput
                                mask={[
                                    { mask: '000.000.000-00', maxLength: 11 },
                                    { mask: '00.000.000/0000-00', maxLength: 14 }
                                ]}
                                id="cpfCnpj"
                                value={cpfCnpj}
                                onAccept={(value) => setCpfCnpj(String(value))} // Atualizar state
                                placeholder="Seu CPF ou CNPJ"
                                className={cn(
                                    "col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                                    cpfCnpjError ? "border-red-500 focus-visible:ring-red-500" : ""
                                )}
                                unmask={true} // Enviar valor sem máscara para o state? Melhor não, tratar na submissão.
                                lazy={false} // Aplicar máscara imediatamente
                            />
                        </div>
                        {cpfCnpjError && (
                            <p className="col-span-4 text-sm text-red-600 dark:text-red-400 text-center">{cpfCnpjError}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <SecondaryButton type="button" onClick={() => setIsCpfModalOpen(false)} disabled={cpfCnpjLoading}>
                            Cancelar
                        </SecondaryButton>
                        <PrimaryButton type="submit" disabled={cpfCnpjLoading || !cpfCnpj}>
                            {cpfCnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar e Pagar"}
                        </PrimaryButton>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

      </div> {/* Fechamento do max-w-5xl mx-auto */}
    </div> // Fechamento da div principal
  );
}