import React, { useState, useEffect } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';

const UpsellNotice: React.FC = () => (
  <div className="flex justify-center items-center h-[calc(100vh-200px)]">
    <Alert variant="default" className="max-w-lg border-primary bg-primary/5">
      <Lock className="h-5 w-5 text-primary" />
      <AlertTitle className="font-bold text-lg text-primary">Funcionalidade Exclusiva para Assinantes</AlertTitle>
      <AlertDescription className="mt-2">
        Acompanhe as execuções em tempo real e tenha insights instantâneos sobre o que está tocando agora!
        <br />
        Faça upgrade para um plano pago e desbloqueie esta e outras funcionalidades poderosas.
      </AlertDescription>
      <Button asChild className="mt-4">
        <Link to="/plans">Ver Planos de Assinatura</Link>
      </Button>
    </Alert>
  </div>
);

export default function RealTime() {
  const { planId } = useAuth();
  const [displayMode, setDisplayMode] = useState<'loading' | 'upsell' | 'content'>('loading');

  console.log(`[RealTime useEffect Approach] Render. Current planId: ${planId}, Current displayMode: ${displayMode}`);

  useEffect(() => {
    console.log(`[RealTime useEffect Approach] useEffect running. planId: ${planId}`);
    if (planId === null || planId === undefined) {
      console.log('[RealTime useEffect Approach] Setting displayMode to loading');
      setDisplayMode('loading');
    } else if (planId === 'FREE') {
      console.log('[RealTime useEffect Approach] Setting displayMode to upsell');
      setDisplayMode('upsell');
    } else {
      console.log(`[RealTime useEffect Approach] Setting displayMode to content (planId: ${planId})`);
      setDisplayMode('content');
    }
  }, [planId]);

  if (displayMode === 'loading') {
    console.log('[RealTime useEffect Approach] Rendering Loader.');
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (displayMode === 'upsell') {
    console.log('[RealTime useEffect Approach] Rendering UpsellNotice.');
    return <UpsellNotice />;
  }

  if (displayMode === 'content') {
    console.log('[RealTime useEffect Approach] Rendering Content placeholder.');
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
          <p>Conteúdo principal seria renderizado aqui (Plano: {planId}).</p>
      </div>
    );
  }

  console.log('[RealTime useEffect Approach] Rendering null fallback.');
  return null;
}
