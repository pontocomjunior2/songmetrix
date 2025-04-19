import React from 'react';
import { useAuth } from '../hooks/useAuth'; // Corrigido
import { UpgradePrompt } from './Common/UpgradePrompt'; // Corrigido
import RelatoriosWizard from './Relatorios.wizard';

export default function Relatorios() {
  const { planId } = useAuth();

  // Se for trial expirado (Free), mostrar prompt de upgrade
  if (planId === 'expired_trial') {
    return (
      <UpgradePrompt
        isBlocking={true} // Indicar que é bloqueio de página
        message="A geração de Relatórios é uma funcionalidade exclusiva para assinantes Premium. Atualize seu plano para obter acesso."
      />
    );
  }

  // Se não for trial expirado, renderizar conteúdo normal da página
  return <RelatoriosWizard />;
}
