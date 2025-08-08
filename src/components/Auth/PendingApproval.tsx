import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Mail, Clock, CheckCircle, Zap, BarChart3, Settings, AlertTriangle } from 'lucide-react';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface Benefit {
  text: string;
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

  const benefits: Benefit[] = [
    { text: 'Cobertura nacional com monitoramento de rádios em todas as regiões' },
    { text: 'Suporte especializado para otimizar sua programação musical' },
    { text: 'Interface intuitiva e fácil de usar' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-slate-800/[0.2]" />
      
      {/* Radial Gradient Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-16">
        {/* Logo Section */}
        <div className="max-w-md mx-auto mb-12">
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
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
        <Card className="max-w-lg mx-auto bg-slate-800/40 backdrop-blur-xl border-slate-700/50 shadow-2xl">
          <CardHeader className="text-center pb-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <CardTitle className="text-xl font-semibold text-slate-100">
              14 dias grátis ativados!
            </CardTitle>
            <CardDescription className="text-slate-400">
              Confirme seu email para começar
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Alert className="bg-blue-500/10 border-blue-500/20 text-slate-300">
              <Mail className="h-4 w-4" />
              <AlertDescription>
                <p className="text-sm">Enviamos um email de confirmação para você</p>
              </AlertDescription>
            </Alert>

            <Alert className="bg-amber-500/10 border-amber-500/20 text-slate-300">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="text-sm">Não esqueça de verificar sua caixa de spam</p>
              </AlertDescription>
            </Alert>

            <div className="text-center pt-2">
              <Button 
                asChild 
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 shadow-lg shadow-blue-500/25"
              >
                <Link to="/login">
                  Voltar ao login
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto mt-12">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="bg-slate-800/30 backdrop-blur-xl border-slate-700/50 hover:bg-slate-800/50 transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                    {feature.icon}
                  </div>
                  <h3 className="text-base font-semibold text-slate-100">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-sm text-slate-400">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Support */}
        <div className="text-center mt-12">
          <p className="text-sm text-slate-400 mb-2">Dúvidas? Fale conosco</p>
          <a 
            href="mailto:contato@songmetrix.com.br" 
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            contato@songmetrix.com.br
          </a>
        </div>
      </div>
    </div>
  );
}
