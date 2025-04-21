import express from 'express';
import { authenticateUser } from '../auth-middleware.js';
import { updateAsaasCustomer } from '../services/asaasService.js';

const router = express.Router();

// Rota para atualizar dados do cliente no Asaas (especificamente CPF/CNPJ por agora)
router.put('/update-asaas', authenticateUser, async (req, res) => {
    const userId = req.user?.id;
    const { cpfCnpj } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (!cpfCnpj) {
        return res.status(400).json({ error: 'CPF/CNPJ é obrigatório.' });
    }

    // Validação básica do CPF/CNPJ (remover não-dígitos e verificar tamanho)
    const cleanedCpfCnpj = String(cpfCnpj).replace(/\\D/g, '');
    if (cleanedCpfCnpj.length !== 11 && cleanedCpfCnpj.length !== 14) {
        return res.status(400).json({ error: 'Formato inválido de CPF/CNPJ.' });
    }

    try {
        console.log(`[Route /update-asaas] Tentando atualizar Asaas para userId: ${userId} com CPF/CNPJ.`);
        const success = await updateAsaasCustomer(userId, { cpfCnpj: cleanedCpfCnpj });

        if (success) {
            console.log(`[Route /update-asaas] Cliente Asaas atualizado com sucesso para userId: ${userId}.`);
            res.status(200).json({ success: true, message: 'Dados do cliente atualizados com sucesso no gateway.' });
        } else {
            console.error(`[Route /update-asaas] Falha ao chamar updateAsaasCustomer para userId: ${userId}.`);
            // Idealmente, o erro específico já foi logado no service
            res.status(500).json({ error: 'Falha ao atualizar dados do cliente no gateway de pagamento.' });
        }
    } catch (error) {
        console.error(`[Route /update-asaas] Erro inesperado para userId: ${userId}:`, error);
        res.status(500).json({ error: 'Erro interno do servidor ao atualizar dados do cliente.' });
    }
});

export default router; 