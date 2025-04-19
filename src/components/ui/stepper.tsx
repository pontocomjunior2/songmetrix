"use client"; // Potencialmente necessário se houver interatividade no futuro

import * as React from "react";
import { cn } from "@/lib/utils"; // Assumindo que utils está em @/lib

// --- Interfaces ---

interface Step {
  label: string;
  description?: string;
  icon?: React.ReactNode; // Opcional: Ícone para o passo
}

interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: Step[];
  currentStep: number; // Índice baseado em 0
  orientation?: "horizontal" | "vertical";
  // Remover prop size
  // Adicionar mais props conforme necessário
}

// --- Componente ---

function Stepper({
  steps,
  currentStep,
  orientation = "horizontal",
  className,
  ...props
}: StepperProps) {
  
  // Validação básica das props
  if (currentStep < 0 || currentStep >= steps.length) {
    console.warn("Stepper: currentStep index is out of bounds.");
    // Poderia retornar null ou um erro visual
  }

  const isVertical = orientation === "vertical";

  return (
    <div
      className={cn(
        "flex", // Voltar para flex simples
        isVertical ? "flex-col h-full" : "w-full items-center", // Restaurar items-center
        "px-8", // Aumentar padding horizontal interno para px-8
        className
      )}
      {...props}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isLastStep = index === steps.length - 1;

        return (
          <React.Fragment key={step.label}>
            <div className={cn("flex items-center", isVertical ? "flex-row" : "flex-col relative")}>
              {/* Círculo/Ícone do Passo - Remover classes de tamanho */}
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border-2 w-8 h-8 text-sm transition-all duration-300", // Voltar para tamanho fixo md
                  isActive
                    ? "bg-blue-600 border-blue-600 text-white"
                    : isCompleted
                    ? "bg-blue-100 border-blue-600 text-blue-600"
                    : "bg-gray-100 border-gray-300 text-gray-500",
                  isVertical ? "mr-4" : "mb-2"
                )}
              >
                {index + 1}
              </div>
              {/* Rótulo e Descrição (Horizontal) - Remover classes de tamanho */}
              {!isVertical && (
                <div className="absolute top-full mt-2 text-center w-max max-w-xs px-1">
                  <div className={cn(
                    "text-sm font-medium", // Voltar para tamanho fixo md
                    isActive || isCompleted ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"
                  )}>
                    {step.label}
                  </div>
                  {step.description && (
                    <div className={cn(
                      "text-xs text-gray-500 dark:text-gray-400", // Voltar para tamanho fixo md
                    )}>
                      {step.description}
                    </div>
                  )}
                </div>
              )}
               {/* Rótulo e Descrição (Vertical) - Remover classes de tamanho */}
               {isVertical && (
                <div>
                  <div className={cn(
                    "text-sm font-medium", // Voltar para tamanho fixo md
                    isActive || isCompleted ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"
                  )}>
                    {step.label}
                  </div>
                  {step.description && (
                    <div className={cn(
                      "text-xs text-gray-500 dark:text-gray-400", // Voltar para tamanho fixo md
                    )}>
                      {step.description}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Linha Conectora */}
            {!isLastStep && (
              <div
                className={cn(
                  "flex-1 border-t-2 transition-colors duration-300",
                  isCompleted ? "border-blue-600" : "border-gray-300",
                  isVertical ? "ml-4 h-auto min-h-[40px] w-0 border-l-2 border-t-0" : "mx-4"
                )}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export { Stepper, type StepperProps, type Step }; 