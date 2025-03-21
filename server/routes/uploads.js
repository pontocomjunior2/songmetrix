import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireAdmin, verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// Configure CORS for image uploads
router.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if(!origin) return callback(null, true);
    
    // Allow localhost and production URL
    const allowedOrigins = ['http://localhost:5173', 'https://songmetrix.com.br'];
    if(allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['Content-Type', 'Content-Disposition']
}));

// Add headers for image serving
router.use('/logos', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Função para normalizar o nome da rádio para uso no nome do arquivo
const normalizeRadioName = (radioName) => {
  if (!radioName) return '';
  
  return radioName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^\w\s-]/g, '') // Remover caracteres especiais
    .replace(/\s+/g, '_') // Substituir espaços por underscores
    .toLowerCase(); // Converter para minúsculas
};

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
    // Tentar usar o nome normalizado recebido do cliente
    if (req.body && req.body.normalizedFileName) {
      console.log('Usando nome normalizado fornecido pelo cliente:', req.body.normalizedFileName);
      cb(null, req.body.normalizedFileName);
      return;
    }
    
    // Se temos o nome da rádio, normalizar e usar como nome do arquivo
    if (req.body && req.body.radioName) {
      const radioName = req.body.radioName;
      const normalizedName = normalizeRadioName(radioName);
      if (normalizedName) {
        const fileExtension = path.extname(file.originalname) || '.png';
        const fileName = `${normalizedName}${fileExtension}`;
        console.log('Nome normalizado gerado para a rádio:', fileName);
        cb(null, fileName);
        return;
      }
    }
    
    // Usar o nome de arquivo personalizado se fornecido
    if (req.body && req.body.fileName) {
      cb(null, req.body.fileName);
      return;
    }
    
    // Gerar um nome de arquivo único usando UUID como último recurso
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    console.log('Usando UUID como nome de arquivo:', uniqueFilename);
    cb(null, uniqueFilename);
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
  // Configurar CORS para esta rota específica
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
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
    const normalizedFileName = req.body.normalizedFileName || '';
    
    console.log('Informações da rádio:', { 
      radioId, 
      radioName, 
      fileName: file.filename,
      normalizedFileName
    });

    // Verificar se o arquivo foi salvo com o nome normalizado ou com UUID
    const isNormalizedName = file.filename.includes('_');
    const isUuidName = file.filename.includes('-');
    
    // Se o arquivo foi salvo com UUID mas temos o nome normalizado, renomear
    if (isUuidName && normalizedFileName && normalizedFileName !== file.filename) {
      try {
        const oldPath = file.path;
        const newPath = path.join(path.dirname(oldPath), normalizedFileName);
        
        console.log('Renomeando arquivo:', {
          de: oldPath,
          para: newPath,
          nomeAntigo: file.filename,
          nomeNovo: normalizedFileName
        });
        
        // Verificar se o arquivo existe antes de tentar renomear
        if (fs.existsSync(oldPath)) {
          // Remover arquivo antigo se já existir
          if (fs.existsSync(newPath)) {
            fs.unlinkSync(newPath);
            console.log('Arquivo antigo removido:', newPath);
          }
          
          // Renomear o arquivo
          fs.renameSync(oldPath, newPath);
          console.log('Arquivo renomeado com sucesso');
          
          // Atualizar o nome do arquivo
          file.filename = normalizedFileName;
          file.path = newPath;
        } else {
          console.warn('Arquivo original não encontrado:', oldPath);
        }
      } catch (renameError) {
        console.error('Erro ao renomear arquivo:', renameError);
        // Continuar com o nome original em caso de erro
      }
    }

    // Construir a URL do arquivo
    // Sempre usar a URL de produção para garantir compatibilidade entre ambientes
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://songmetrix.com.br' 
      : req.protocol + '://' + req.get('host');
    
    // Forçar URL de produção para evitar problemas de compatibilidade
    const prodUrl = 'https://songmetrix.com.br';
    
    // Usar URL de produção para o cliente, mas manter URL local nos logs
    const fileUrl = `${prodUrl}/uploads/logos/${file.filename}`;
    const localUrl = `${baseUrl}/uploads/logos/${file.filename}`;
    
    console.log('Arquivo salvo com sucesso:', file.path);
    console.log('URL local do arquivo:', localUrl);
    console.log('URL de produção do arquivo:', fileUrl);

    // Retornar a URL do arquivo
    return res.json({ 
      success: true, 
      url: fileUrl,
      fileName: file.filename,
      radioId,
      radioName,
      normalized: isNormalizedName || normalizedFileName === file.filename
    });
  } catch (error) {
    console.error('Erro ao fazer upload de logo:', error);
    return res.status(500).json({ success: false, message: 'Erro ao fazer upload de logo' });
  }
});

export default router;