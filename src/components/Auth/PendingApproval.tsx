import React from 'react';
import { Link } from 'react-router-dom';

export default function PendingApproval() {
  const features = [
    {
      icon: (
        <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
      ),
      title: 'Monitoramento Inteligente',
      description: 'Acompanhe a programação musical das principais rádios brasileiras com atualizações em tempo real'
    },
    {
      icon: (
        <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
        </svg>
      ),
      title: 'Insights Estratégicos',
      description: 'Descubra tendências e padrões musicais com nossa análise detalhada de dados'
    },
    {
      icon: (
        <svg className="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      ),
      title: 'Gestão Personalizada',
      description: 'Ferramentas flexíveis para criar relatórios e análises adaptados às suas necessidades'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-800 to-navy-900 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 1px, transparent 1px)`,
        backgroundSize: '24px 24px'
      }}></div>

      {/* Subtle Accent Lines */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full transform rotate-12">
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent"></div>
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-indigo-400/10 to-transparent mt-32"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-16">
        {/* Logo and Header */}
        <div className="max-w-5xl mx-auto text-center mb-20">
          <img
            src="/logo-1280x256.png"
            alt="SongMetrix"
            className="w-full max-w-2xl mx-auto h-auto mb-12 animate-fade-in"
          />
          <h1 className="text-5xl font-bold text-white mb-8 animate-fade-in">
            Inteligência musical para sua rádio
          </h1>
        </div>

        {/* Welcome Card */}
        <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-lg rounded-3xl p-12 mb-20 shadow-2xl transform hover:scale-[1.01] transition-all duration-300">
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>

          <h2 className="text-4xl font-bold text-white mb-6 text-center">
            Parabéns! Você ganhou 7 dias de teste grátis! 🎉
          </h2>

          <div className="bg-gradient-to-r from-blue-500/20 to-indigo-500/20 p-6 rounded-xl mb-8 border border-blue-400/30">
            <p className="text-2xl text-white/90 mb-4 text-center">
              Sua conta foi criada com sucesso! Para ativar seus 7 dias gratuitos, basta confirmar seu email.
            </p>
            <p className="text-xl text-white/90 text-center font-semibold">
              ✉️ Verifique sua caixa de entrada agora!
            </p>
          </div>

          <p className="text-xl text-white/80 mb-8 text-center">
            Durante seu período de teste, você terá acesso completo a todas as funcionalidades premium do SongMetrix. Descubra como nossa tecnologia exclusiva de monitoramento em tempo real pode revolucionar a programação musical da sua rádio! ✨
          </p>

          <div className="text-center">
            <Link
              to="/login"
              className="inline-block bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-lg font-medium px-10 py-4 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              Voltar para o Login
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-lg p-8 rounded-2xl shadow-xl hover:bg-white/10 transition-all duration-300 transform hover:scale-105"
            >
              <div className="mb-6">{feature.icon}</div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                {feature.title}
              </h3>
              <p className="text-lg text-white/70">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Benefits Section */}
        <div className="max-w-4xl mx-auto bg-white/5 backdrop-blur-lg rounded-2xl p-10">
          <h3 className="text-3xl font-semibold text-white mb-8 text-center">
            Recursos Exclusivos
          </h3>
          <ul className="space-y-6">
            <li className="flex items-start">
              <svg className="w-8 h-8 text-green-400 mr-4 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span className="text-white/90 text-xl">Cobertura nacional com monitoramento de rádios em todas as regiões</span>
            </li>
            <li className="flex items-start">
              <svg className="w-8 h-8 text-green-400 mr-4 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span className="text-white/90 text-xl">Suporte especializado para otimizar sua programação musical</span>
            </li>
            <li className="flex items-start">
              <svg className="w-8 h-8 text-green-400 mr-4 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span className="text-white/90 text-xl">Interface intuitiva e fácil de usar</span>
            </li>
          </ul>
        </div>

        {/* Support Footer */}
        <div className="max-w-4xl mx-auto mt-16 text-center">
          <div className="p-6 bg-white/5 backdrop-blur-lg rounded-2xl">
            <h4 className="text-xl font-semibold text-white mb-4">Precisa de ajuda?</h4>
            <p className="text-white/80 mb-4">Nossa equipe de suporte está pronta para ajudar você</p>
            <a href="mailto:suporte@songmetrix.com" className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
              suporte@songmetrix.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
