import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { TrialExpiredMessage } from '../Messages/TrialExpiredMessage';
import { Loader2 } from 'lucide-react'; // Ou seu componente de loading

interface TrialRestrictedProps {
  children: React.ReactNode;
}

export function TrialRestricted({ children }: TrialRestrictedProps) {
  const { planId, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  const isTrialExpired = planId === 'expired_trial';

  return (
    <div className="relative w-full h-full">
      <div className={isTrialExpired ? 'filter blur-sm pointer-events-none opacity-50 w-full h-full overflow-hidden' : 'w-full h-full'}>
        {children}
      </div>
      {isTrialExpired && (
        <div className="absolute inset-0 flex items-center justify-center z-10 p-4 bg-background/80">
           <TrialExpiredMessage />
        </div>
      )}
    </div>
  );
} 