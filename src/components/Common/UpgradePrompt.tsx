import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Ajustar path se necessário
import { Button } from '@/components/ui/button'; // Ajustar path se necessário
import { Link } from 'react-router-dom'; // <<< USAR ESTE
import { Lock } from 'lucide-react'; // Mudar ícone para algo mais apropriado para bloqueio

interface UpgradePromptProps {
  title?: string;
  message: string;
  buttonText?: string;
  linkTo?: string;
  variant?: "default" | "destructive" | "warning"; // Adicionar variant para Alert
  isBlocking?: boolean; // Nova prop para indicar bloqueio de página
}

export function UpgradePrompt({
  title: customTitle, // Renomear prop para evitar conflito com defaultTitle
  message,
  buttonText = "Ver Planos",
  linkTo = "/plans", // Rota para a página de planos
  variant = "warning", // Manter warning como padrão geral
  isBlocking = false // Padrão é não ser bloqueante
}: UpgradePromptProps) {

  // Definir título e variante com base em isBlocking
  const alertVariant = isBlocking ? "destructive" : variant;
  const defaultTitle = isBlocking ? "Acesso Restrito (Conta Free)" : "Funcionalidade Premium";
  const titleToShow = customTitle ?? defaultTitle; // Usa título customizado se fornecido, senão o padrão

  // Container para centralizar/estilizar o alerta quando bloqueante
  const ContainerWrapper = isBlocking ?
    ({ children }: { children: React.ReactNode }) => (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] px-4"> {/* Centraliza vertical e horizontalmente */}
        {children}
      </div>
    ) :
    React.Fragment; // Não adiciona div extra se não for bloqueante

  return (
    <ContainerWrapper>
      <Alert variant={alertVariant} className={isBlocking ? "max-w-lg w-full shadow-md" : "my-4"}> {/* Estilo adicional para bloqueio */}
        <Lock className="h-4 w-4" /> {/* Ícone de cadeado */}
        <AlertTitle className={isBlocking ? "text-lg font-semibold" : ""}>{titleToShow}</AlertTitle> {/* Título maior se bloqueante */}
        <AlertDescription className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
          <span className="flex-grow">{message}</span>
          {/* O componente Link do react-router-dom usa 'to' em vez de 'href' */}
          <Link to={linkTo}>
             <Button size={isBlocking ? "default" : "sm"} className="mt-2 sm:mt-0 whitespace-nowrap"> {/* Botão maior e sem quebra se bloqueante */}
               {buttonText}
             </Button>
          </Link>
        </AlertDescription>
      </Alert>
    </ContainerWrapper>
  );
} 