import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PrimaryButton } from '../Common/Button';
import { CheckCircle, Star, Award, Zap, Clock, Shield, BarChart2, Users } from 'lucide-react';

export default function Plans() {
  const navigate = useNavigate();
  const location = useLocation();
  const message = location.state?.message || '';
  const isTrialExpired = location.state?.trialExpired || false;
  const { currentUser } = useAuth();

  // Calcular o valor com desconto
  const originalPrice = 2499;
  const discountPercentage = 75;
  const discountedPrice = originalPrice * (1 - discountPercentage / 100);

  // Formatar os preços
  const formatPrice = (price) => {
    return price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSubscribe = async () => {
    if (!currentUser) {
      // Se o usuário não estiver logado, redireciona para o login com informação de retorno
      navigate('/login', { 
        state: { 
          returnTo: '/plans',
          checkoutAfterLogin: true
        }
      });
      return;
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.id,
          priceId: 'price_1QzUlrEYOe4CRJcBzweyvbGn' // ID do preço Stripe do ambiente de teste
        }),
      });
      
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Erro ao criar sessão de checkout:', error);
      alert('Ocorreu um erro ao processar seu pagamento. Por favor, tente novamente.');
    }
  };

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
    <div className="bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto text-center">
        <div className="mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              Transforme sua Programação Musical
            </span>
          </h1>
          <p className="mt-3 max-w-3xl mx-auto text-xl text-gray-600">
            Inteligência de dados para sua rádio se destacar no mercado
          </p>
          
          {isTrialExpired && (
            <div className="mt-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-md max-w-3xl mx-auto text-left">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Seu período de avaliação gratuito expirou. Escolha um plano para continuar utilizando o sistema.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {message && (
            <div className="mt-8 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-md max-w-3xl mx-auto text-left">
              <p className="text-sm text-blue-700">{message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Oferta Especial */}
      <div className="max-w-7xl mx-auto mb-20">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-3xl shadow-xl overflow-hidden">
          <div className="px-6 py-12 md:p-12 lg:flex lg:items-center lg:justify-between">
            <div className="lg:w-0 lg:flex-1">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                <span className="block">Oferta de Lançamento</span>
                <span className="block text-indigo-200">75% de desconto por tempo limitado!</span>
              </h2>
              <p className="mt-4 max-w-3xl text-lg text-indigo-100">
                Aproveite esta oportunidade única e transforme sua rádio com o poder da análise de dados.
              </p>
            </div>
            <div className="mt-8 lg:mt-0 lg:ml-8 lg:flex-shrink-0">
              <div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-lg p-6 text-center">
                <div className="flex items-center justify-center">
                  <div className="text-white text-opacity-70 line-through text-2xl mr-3">
                    R$ {formatPrice(originalPrice)}
                  </div>
                  <div className="text-white text-4xl font-bold">
                    R$ {formatPrice(discountedPrice)}
                  </div>
                </div>
                <p className="text-indigo-200 mt-1">/mês</p>
                <div className="mt-6">
                  <PrimaryButton 
                    fullWidth 
                    onClick={handleSubscribe}
                    className="bg-white text-indigo-600 hover:bg-indigo-50"
                  >
                    Assinar Agora
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recursos */}
      <div className="max-w-7xl mx-auto mb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900">Recursos Exclusivos</h2>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
            Tudo o que você precisa para otimizar sua programação musical
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-8 transition-all duration-300 hover:shadow-lg hover:transform hover:scale-105">
              <div className="mb-5">{feature.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plano Premium Detalhado */}
      <div className="max-w-5xl mx-auto mb-20">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-8 sm:p-10 sm:pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="inline-flex px-4 py-1 rounded-full text-sm font-semibold tracking-wide uppercase bg-indigo-100 text-indigo-600">
                  Plano Premium
                </h3>
                <div className="flex items-baseline mt-4">
                  <span className="text-5xl font-extrabold text-gray-900">R$ {formatPrice(discountedPrice)}</span>
                  <span className="ml-1 text-2xl font-medium text-gray-500">/mês</span>
                </div>
              </div>
              <div className="bg-red-100 text-red-800 rounded-full px-3 py-1 text-sm font-semibold transform rotate-3">
                Economize R$ {formatPrice(originalPrice - discountedPrice)}/mês
              </div>
            </div>
            <p className="mt-5 text-lg text-gray-500">
              Acesso completo a todas as funcionalidades do Songmetrix para impulsionar sua rádio.
            </p>
          </div>
          <div className="px-6 pt-6 pb-8 bg-gray-50 sm:p-10 sm:pt-6">
            <ul className="space-y-4">
              {[
                "Monitoramento ilimitado de rádios",
                "Análise em tempo real da programação",
                "Relatórios personalizados e exportáveis",
                "Análise detalhada da concorrência",
                "Insights estratégicos para sua programação",
                "Suporte prioritário 24/7",
                "Acesso à API de integração",
                "Atualizações e novos recursos prioritários",
                "Consultoria especializada mensal"
              ].map((feature, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  </div>
                  <p className="ml-3 text-base text-gray-700">{feature}</p>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <PrimaryButton 
                fullWidth 
                onClick={handleSubscribe}
              >
                Assinar Premium
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>

      {/* Depoimentos */}
      <div className="max-w-7xl mx-auto mb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900">O que nossos clientes dizem</h2>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
            Histórias de sucesso de rádios que transformaram sua programação com o Songmetrix
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-8 border-l-4 border-indigo-500">
              <div className="flex items-center mb-4">
                <Star className="h-5 w-5 text-yellow-400" />
                <Star className="h-5 w-5 text-yellow-400" />
                <Star className="h-5 w-5 text-yellow-400" />
                <Star className="h-5 w-5 text-yellow-400" />
                <Star className="h-5 w-5 text-yellow-400" />
              </div>
              <p className="text-gray-600 italic mb-6">"{testimonial.quote}"</p>
              <div>
                <p className="font-semibold text-gray-900">{testimonial.author}</p>
                <p className="text-gray-500 text-sm">{testimonial.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-5xl mx-auto mb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900">Perguntas Frequentes</h2>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
            Tire suas dúvidas sobre o Songmetrix
          </p>
        </div>

        <div className="space-y-8">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq.question}</h3>
              <p className="text-gray-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Comparação de Planos */}
      <div className="max-w-7xl mx-auto mb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900">Compare os Planos</h2>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
            Escolha o plano ideal para sua rádio
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Plano Trial */}
          <div className="bg-white rounded-lg shadow-md p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Trial</h3>
            <p className="text-gray-600 mb-6">Experimente por 7 dias</p>
            <ul className="space-y-4">
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <p className="ml-3 text-gray-600">Acesso básico ao monitoramento</p>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <p className="ml-3 text-gray-600">Visualização limitada de relatórios</p>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <p className="ml-3 text-gray-600">Suporte por email</p>
              </li>
            </ul>
          </div>

          {/* Plano Premium */}
          <div className="bg-gradient-to-b from-indigo-50 to-white rounded-lg shadow-md p-8 border-2 border-indigo-500">
            <div className="inline-flex px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-600 mb-4">
              Recomendado
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Premium</h3>
            <p className="text-gray-600 mb-6">Acesso completo a todas as funcionalidades</p>
            <ul className="space-y-4">
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <p className="ml-3 text-gray-600">Monitoramento ilimitado de rádios</p>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <p className="ml-3 text-gray-600">Relatórios detalhados e exportáveis</p>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <p className="ml-3 text-gray-600">Análise de concorrência</p>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <p className="ml-3 text-gray-600">Suporte prioritário 24/7</p>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <p className="ml-3 text-gray-600">Consultoria especializada mensal</p>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Contato */}
      <div className="max-w-3xl mx-auto mb-20 text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-8">Ainda tem dúvidas?</h2>
        <p className="text-xl text-gray-600 mb-8">
          Nossa equipe está pronta para ajudar você a escolher o melhor plano para sua rádio.
        </p>
        <PrimaryButton
          onClick={() => navigate('/my-plan', { state: { plan: 'Premium' } })}
          className="px-8 py-3 text-lg"
        >
          Fale com um Especialista
        </PrimaryButton>
      </div>
    </div>
  );
}