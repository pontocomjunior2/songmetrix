import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireAdmin, verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// Configurar o armazenamento para o multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
    
    // Criar o diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Usar o nome de arquivo personalizado se fornecido
    if (req.body && req.body.fileName) {
      cb(null, req.body.fileName);
    } else {
      // Gerar um nome de arquivo único usando UUID
      const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueFilename);
    }
  }
});

// Filtro para aceitar apenas imagens
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado. Apenas JPG, PNG, GIF e WEBP são permitidos.'), false);
  }
};

// Configurar o upload com multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // Limite de 2MB
  }
});

/**
 * @route POST /api/uploads/logo
 * @desc Upload de logotipo de rádio
 * @access Private (Admin)
 */
router.post('/logo', upload.single('logo'), async (req, res) => {
  try {
    // Verificar se o usuário está autenticado
    const authResult = await verifyAuth(req);
    if (!authResult.authenticated) {
      return res.status(401).json({ success: false, message: 'Não autorizado' });
    }

    // Verificar se o arquivo foi enviado
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });
    }

    // Obter informações do arquivo
    const file = req.file;
    
    // Obter informações da rádio, se disponíveis
    const radioId = req.body.radioId || '';
    const radioName = req.body.radioName || '';
    console.log('Informações da rádio:', { radioId, radioName, fileName: file.filename });

    // Construir a URL do arquivo
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://songmetrix.com.br' 
      : `http://localhost:${process.env.PORT || 3001}`;
    
    const fileUrl = `${baseUrl}/uploads/logos/${file.filename}`;
    
    console.log('Arquivo salvo com sucesso:', file.path);
    console.log('URL do arquivo:', fileUrl);

    // Retornar a URL do arquivo
    return res.json({ 
      success: true, 
      url: fileUrl,
      fileName: file.filename,
      radioId,
      radioName
    });
  } catch (error) {
    console.error('Erro ao fazer upload de logo:', error);
    return res.status(500).json({ success: false, message: 'Erro ao fazer upload de logo' });
  }
});

export default router; 