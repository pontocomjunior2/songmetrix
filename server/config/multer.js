const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuração de armazenamento para uploads
const storage = multer.memoryStorage(); // Usar memoryStorage para processar o arquivo na memória

// Filtro para permitir apenas imagens
const fileFilter = (req, file, cb) => {
  // Verificar se o arquivo é uma imagem
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Apenas imagens são permitidas'), false);
  }
};

// Configuração do multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite de 5MB
  }
});

module.exports = upload; 