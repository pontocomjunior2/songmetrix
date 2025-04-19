import React from 'react';
import { Button } from '@/components/ui/button'; // Assumindo Shadcn UI no monorepo
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'; // Importar CardFooter explicitamente
import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function TrialExpiredMessage() {
  const navigate = useNavigate();

  const handleViewPlans = () => {
    // Navegar para a página de planos (a ser criada)
    navigate('/plans'); // Ajuste a rota se necessário
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg bg-background border-destructive">
      <CardHeader className="flex flex-row items-center space-x-3 pb-4">
         <AlertCircle className="h-8 w-8 text-destructive" />
         <div className="flex flex-col">
            <CardTitle className="text-xl text-destructive">Período de Teste Expirado</CardTitle>
            <CardDescription>Sua avaliação gratuita de 14 dias terminou.</CardDescription>
          </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Esta funcionalidade está disponível apenas para assinantes. Para desbloquear este recurso e todos os outros benefícios do Songmetrix, por favor, escolha um de nossos planos.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleViewPlans} className="w-full" variant="destructive">
          Ver Planos
        </Button>
      </CardFooter>
    </Card>
  );
} 