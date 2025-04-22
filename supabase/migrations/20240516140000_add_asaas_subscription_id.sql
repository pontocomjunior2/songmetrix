-- Adiciona a coluna para armazenar o ID da assinatura do Asaas
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT NULL;

-- Opcional: Adicionar um comentário à coluna para documentação
COMMENT ON COLUMN public.users.asaas_subscription_id IS 'Armazena o ID da assinatura recorrente do usuário no gateway de pagamento Asaas.'; 