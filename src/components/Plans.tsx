import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

function Plans() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="flex flex-row items-center space-x-3 pb-4">
          <DollarSign className="h-8 w-8 text-primary" />
          <div className="flex flex-col">
            <CardTitle className="text-xl">Nossos Planos</CardTitle>
            <CardDescription>Escolha o plano ideal para suas necessidades.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">Em Breve!</h2>
            <p className="text-muted-foreground">
              Estamos finalizando os detalhes dos nossos planos e a integração com o sistema de pagamento.
              Volte em breve para conferir as opções!
            </p>
            {/* Aqui futuramente serão listados os cards dos planos */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Plans; 