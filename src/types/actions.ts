import type { AppError } from '@/lib/errors';

/**
 * Tipo de resposta padrão para Server Actions usando next-safe-action.
 */
export type ActionResponse<T = unknown> = 
  | { success: true; data: T }
  | { success: false; error: AppError }; 