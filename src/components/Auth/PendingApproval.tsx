import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Clock, Zap, BarChart3, Settings, AlertTriangle } from 'lucide-react';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}


export default function PendingApproval() {
  const features: Feature[] = [
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Monitoramento Inteligente',
      description: 'Acompanhe a programação musical das principais rádios brasileiras em tempo real'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Insights Estratégicos',
      description: 'Descubra tendências e padrões musicais com análise detalhada'
    },
    {
      icon: <Settings className="w-6 h-6" />,
      title: 'Gestão Personalizada',
      description: 'Ferramentas flexíveis para criar relatórios adaptados às suas necessidades'
    }
  ];


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Radial Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20" />

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-6 md:py-12 lg:py-16">
        {/* Logo Section */}
        <div className="max-w-sm md:max-w-md mx-auto mb-6 md:mb-8 lg:mb-12">
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-4 md:p-6 lg:p-8 border border-slate-700/50 shadow-xl">
            <img
              src="/logo-1280x256.png"
              alt="SongMetrix"
              className="w-full h-auto filter brightness-110"
              loading="lazy"
              width="1280"
              height="256"
            />
          </div>
        </div>

        {/* Welcome Card */}
        <div className="max-w-md md:max-w-lg mx-auto bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-lg">
          <div className="text-center pb-4 px-4 md:px-6 pt-6">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-slate-100 mb-2">
              14 dias grátis ativados!
            </h2>
            <p className="text-slate-400 text-sm md:text-base">
              Confirme seu email para começar
            </p>
          </div>

          <div className="space-y-4 px-4 md:px-6 pb-6">
            <div className="bg-blue-500/10 border border-blue-500/20 text-slate-300 rounded-lg p-3 flex items-start space-x-3">
              <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm">Enviamos um email de confirmação para você</p>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 text-slate-300 rounded-lg p-3 flex items-start space-x-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm">Não esqueça de verificar sua caixa de spam</p>
              </div>
            </div>

            <div className="text-center pt-2">
              <Link to="/login">
                <button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 shadow-lg shadow-blue-500/25 rounded-md px-6 py-2 w-full md:w-auto transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/30">
                  Voltar ao login
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto mt-6 md:mt-8 lg:mt-12">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 hover:bg-slate-800/50 transition-all duration-300 shadow-lg rounded-lg p-4 md:p-6"
            >
              <div className="flex items-start space-x-3 mb-3">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 flex-shrink-0">
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm md:text-base font-semibold text-slate-100 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Support */}
        <div className="text-center mt-6 md:mt-8 lg:mt-12">
          <p className="text-sm text-slate-400 mb-2">Dúvidas? Fale conosco</p>
          <a
            href="mailto:contato@songmetrix.com.br"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors inline-block hover:underline"
          >
            contato@songmetrix.com.br
          </a>
        </div>
      </div>
    </div>
  );
}
