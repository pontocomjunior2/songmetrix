// server.js - use importações ESM
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// Obter o diretório atual em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Definir diretório de uploads
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'logos');

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Garantir que o diretório exista
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Gerar nome único para o arquivo
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Middleware para logging de requisições
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rota para criar diretório de uploads
app.post('/api/ensure-uploads-directory', (req, res) => {
  try {
    // Garantir que o diretório de uploads exista
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`Diretório de uploads criado: ${uploadsDir}`);
    } else {
      console.log(`Diretório de uploads já existe: ${uploadsDir}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'Diretório de uploads verificado/criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao verificar/criar diretório de uploads:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar/criar diretório de uploads',
      error: error.message
    });
  }
});

// Rota para salvar arquivo em desenvolvimento
app.post('/api/dev-save-uploaded-file', (req, res) => {
  try {
    const { fileData, fileName, contentType } = req.body;
    
    if (!fileData || !fileName) {
      return res.status(400).json({
        success: false,
        message: 'Dados de arquivo incompletos'
      });
    }
    
    // Garantir que o diretório de uploads exista
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Extrair dados da Base64
    const base64Data = fileData.split(';base64,').pop();
    const filePath = path.join(uploadsDir, fileName);
    
    // Salvar o arquivo
    fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });
    
    console.log(`Arquivo salvo localmente em: ${filePath}`);
    
    res.status(200).json({
      success: true,
      message: 'Arquivo salvo com sucesso',
      filePath: `/uploads/logos/${fileName}`
    });
  } catch (error) {
    console.error('Erro ao salvar arquivo localmente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao salvar arquivo localmente',
      error: error.message
    });
  }
});

// Rota para upload de logo em desenvolvimento
app.post('/api/uploads/logo', upload.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado'
      });
    }
    
    const radioName = req.body.radioName || 'Radio sem nome';
    
    const fileName = req.file.filename;
    const fileUrl = `http://localhost:${PORT}/uploads/logos/${fileName}`;
    
    console.log(`Upload realizado com sucesso: ${fileUrl}`);
    console.log(`Nome da rádio: ${radioName}`);
    
    res.status(200).json({
      success: true,
      message: 'Upload realizado com sucesso',
      url: fileUrl,
      fileName: fileName
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erro no upload',
      error: error.message
    });
  }
});

// Rota para atualizar stream em desenvolvimento
app.put('/api/streams/:id', (req, res) => {
  try {
    const streamId = req.params.id;
    const streamData = req.body;
    
    console.log(`[DEV] Atualização de stream solicitada para ID: ${streamId}`);
    console.log(`[DEV] Dados recebidos:`, streamData);
    
    // Verificar se o ID na rota corresponde ao ID nos dados
    if (streamData.id && streamData.id.toString() !== streamId.toString()) {
      console.warn(`[DEV] Inconsistência de IDs: ID na rota (${streamId}) difere do ID nos dados (${streamData.id})`);
    }
    
    // Em ambiente de desenvolvimento, apenas simular a atualização
    // e repassar para a API de produção através do proxy
    
    // Poderíamos armazenar localmente, mas para manter a consistência,
    // vamos apenas retornar uma resposta simulada de sucesso
    console.log('[DEV] Simulando atualização bem-sucedida');
    
    // Retornar os mesmos dados recebidos como confirmação
    res.status(200).json({
      ...streamData,
      id: streamId, // Garantir que o ID correto seja retornado
      _dev_note: 'Atualização simulada em ambiente de desenvolvimento'
    });
  } catch (error) {
    console.error('[DEV] Erro ao processar atualização de stream:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar stream em ambiente de desenvolvimento',
      error: error.message
    });
  }
});

// Proxy para API em produção quando necessário
const apiProxyTarget = process.env.API_PROXY_TARGET || 'https://songmetrix.com.br';
app.use('/api', createProxyMiddleware({
  target: apiProxyTarget,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxy request to: ${apiProxyTarget}${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.writeHead(500, {
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify({
      error: 'Proxy error',
      message: err.message
    }));
  }
}));

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de desenvolvimento rodando na porta ${PORT}`);
  console.log(`Diretório de uploads: ${uploadsDir}`);
}); 