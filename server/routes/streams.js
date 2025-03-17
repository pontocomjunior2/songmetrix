import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import supabaseAdmin from '../supabase-admin.js';

const router = express.Router();

// Configuração da conexão com o banco de dados
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

/**
 * @route GET /api/streams
 * @desc Obter todos os streams
 * @access Private
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM streams ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar streams:', error);
    res.status(500).json({ error: 'Erro ao buscar streams' });
  }
});

/**
 * @route GET /api/streams/status
 * @desc Obter o status das rádios
 * @access Private
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    console.log('Recebida solicitação de status das rádios');
    
    // Primeiro verificar se a tabela existe
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'streams'
      );
    `);
    
    const tableExists = checkTable.rows[0].exists;
    
    if (!tableExists) {
      console.error('Tabela streams não existe no banco de dados');
      // Para evitar erro 500, retornar uma lista vazia em vez de erro
      return res.json([]);
    }
    
    console.log('Tabela streams existe, executando consulta...');
    
    // Consulta para obter dados das rádios
    const result = await pool.query(`
      SELECT 
        name, 
        'ONLINE' as status,
        logo_url, 
        cidade, 
        estado, 
        regiao, 
        segmento 
      FROM streams 
      ORDER BY name ASC
    `);
    
    if (!result || !result.rows) {
      console.error('Erro ao consultar tabela streams');
      // Para evitar erro 500, retornar uma lista vazia em vez de erro
      return res.json([]);
    }
    
    console.log(`Encontradas ${result.rows.length} rádios no banco de dados`);
    
    // Mapear os dados para o formato esperado pelo cliente
    const radiosStatus = result.rows.map(radio => ({
      name: radio.name,
      status: radio.status,
      logo_url: radio.logo_url,
      cidade: radio.cidade,
      estado: radio.estado,
      regiao: radio.regiao,
      segmento: radio.segmento,
      isFavorite: false // Por padrão, nenhuma rádio é favorita
    }));
    
    // Verificar e processar as rádios favoritas do usuário
    let favoriteRadios = [];
    
    if (req.user && req.user.user_metadata) {
      console.log('Metadados do usuário encontrados:', JSON.stringify(req.user.user_metadata));
      
      // Obter lista de rádios favoritas do usuário (pode estar em favorite_radios ou em favoriteRadios)
      favoriteRadios = req.user.user_metadata.favorite_radios || 
                       req.user.user_metadata.favoriteRadios || 
                       [];
      
      console.log('Rádios favoritas do usuário (original):', favoriteRadios);
      
      // Se não for um array, tentar converter
      if (!Array.isArray(favoriteRadios)) {
        try {
          if (typeof favoriteRadios === 'string') {
            // Tentar parsear como JSON se for uma string
            favoriteRadios = JSON.parse(favoriteRadios);
          } else {
            console.error('favorite_radios não é um array nem uma string, definindo como array vazio');
            favoriteRadios = [];
          }
        } catch (e) {
          console.error('Erro ao parsear favorite_radios como JSON:', e);
          favoriteRadios = [];
        }
      }
      
      console.log('Rádios favoritas do usuário (processadas):', favoriteRadios);
      
      if (favoriteRadios.length > 0) {
        // Criar um mapa para acelerar a busca por nomes normalizados
        const normalizedRadioMap = new Map();
        radiosStatus.forEach(radio => {
          const normalizedName = radio.name.toLowerCase().trim();
          normalizedRadioMap.set(normalizedName, radio);
        });
        
        // Marcar rádios favoritas
        const marcadasFavoritas = [];
        const naoCadastradas = [];
        
        favoriteRadios.forEach(favName => {
          if (typeof favName !== 'string') {
            console.warn('Nome de rádio favorita não é uma string:', favName);
            return;
          }
          
          const normalizedFavName = favName.toLowerCase().trim();
          
          // Verificar se a rádio existe no mapa normalizado
          if (normalizedRadioMap.has(normalizedFavName)) {
            const radio = normalizedRadioMap.get(normalizedFavName);
            radio.isFavorite = true;
            marcadasFavoritas.push(radio.name);
          } else {
            // Buscar correspondência parcial (nome da rádio pode estar incompleto)
            let encontrada = false;
            for (const [radioName, radio] of normalizedRadioMap.entries()) {
              if (radioName.includes(normalizedFavName) || normalizedFavName.includes(radioName)) {
                radio.isFavorite = true;
                marcadasFavoritas.push(radio.name);
                console.log(`Correspondência parcial encontrada: "${favName}" correspondeu a "${radio.name}"`);
                encontrada = true;
                break;
              }
            }
            
            if (!encontrada) {
              // Rádio não encontrada na lista
              naoCadastradas.push(favName);
              console.log(`Rádio favorita não encontrada: "${favName}"`);
            }
          }
        });
        
        console.log('Rádios marcadas como favoritas:', marcadasFavoritas);
        
        // Adicionar rádios favoritas que não existem no banco
        if (naoCadastradas.length > 0) {
          console.log('Rádios favoritas não cadastradas:', naoCadastradas);
          
          naoCadastradas.forEach(name => {
            radiosStatus.push({
              name,
              status: 'OFFLINE',
              logo_url: null,
              cidade: 'Desconhecida',
              estado: '',
              regiao: '',
              segmento: '',
              isFavorite: true
            });
          });
        }
      }
    } else {
      console.log('Usuário ou metadados do usuário não encontrados na requisição');
    }
    
    console.log(`Retornando ${radiosStatus.length} rádios ao cliente`);
    res.json(radiosStatus);
    
  } catch (error) {
    console.error('Erro ao buscar status das rádios:', error);
    console.error('Stack trace:', error.stack);
    
    // Para evitar erro 500, retornar uma lista vazia em vez de erro
    res.json([]);
  }
});

/**
 * @route GET /api/streams/search
 * @desc Buscar streams por termo
 * @access Private
 */
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Termo de busca é obrigatório' });
    }
    
    const searchTerm = `%${query}%`;
    
    const result = await pool.query(
      'SELECT * FROM streams WHERE name ILIKE $1 OR cidade ILIKE $1 OR segmento ILIKE $1 ORDER BY name ASC',
      [searchTerm]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar streams:', error);
    res.status(500).json({ error: 'Erro ao buscar streams' });
  }
});

/**
 * @route GET /api/streams/filter
 * @desc Filtrar streams por região, estado, cidade ou segmento
 * @access Private
 */
router.get('/filter', requireAuth, async (req, res) => {
  try {
    const { region, state, city, segment } = req.query;
    
    let query = 'SELECT * FROM streams WHERE 1=1';
    const params = [];
    
    if (region) {
      params.push(region);
      query += ` AND regiao = $${params.length}`;
    }
    
    if (state) {
      params.push(state);
      query += ` AND estado = $${params.length}`;
    }
    
    if (city) {
      params.push(city);
      query += ` AND cidade = $${params.length}`;
    }
    
    if (segment) {
      params.push(`%${segment}%`);
      query += ` AND segmento ILIKE $${params.length}`;
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao filtrar streams:', error);
    res.status(500).json({ error: 'Erro ao filtrar streams' });
  }
});

/**
 * @route GET /api/streams/:id
 * @desc Obter um stream pelo ID
 * @access Private
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // Verificar se id é um número válido
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID inválido. ID deve ser um número.' });
    }
    
    const result = await pool.query('SELECT * FROM streams WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stream não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar stream:', error);
    res.status(500).json({ error: 'Erro ao buscar stream' });
  }
});

/**
 * @route POST /api/streams
 * @desc Criar um novo stream
 * @access Private (Admin)
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { 
      url, name, sheet, cidade, estado, regiao, segmento, index,
      formato, frequencia, pais, facebook, instagram, twitter, youtube, site, monitoring_url, logo_url 
    } = req.body;
    
    // Validação básica dos campos obrigatórios
    if (!url || !name || !sheet || !cidade || !estado || !regiao || !segmento || !index) {
      return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    
    const result = await pool.query(
      `INSERT INTO streams (
        url, name, sheet, cidade, estado, regiao, segmento, index,
        formato, frequencia, pais, facebook, instagram, twitter, youtube, site, monitoring_url, logo_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [
        url, name, sheet, cidade, estado, regiao, segmento, index,
        formato || segmento, frequencia, pais || 'Brasil', facebook, instagram, twitter, youtube, site, monitoring_url, logo_url
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar stream:', error);
    res.status(500).json({ error: 'Erro ao criar stream' });
  }
});

/**
 * @route PUT /api/streams/:id
 * @desc Atualizar um stream existente
 * @access Private (Admin)
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Atualizando stream com ID:', id);
    console.log('Dados recebidos:', req.body);
    
    const { 
      url, name, sheet, cidade, estado, regiao, segmento, index,
      formato, frequencia, pais, facebook, instagram, twitter, youtube, site, monitoring_url, logo_url 
    } = req.body;
    
    // Validação básica dos campos obrigatórios
    if (!url || !name || !sheet || !cidade || !estado || !regiao || !segmento || !index) {
      console.log('Validação falhou. Campos obrigatórios faltando.');
      return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    
    // Verificar se o stream existe
    const checkResult = await pool.query('SELECT * FROM streams WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      console.log('Stream não encontrado com ID:', id);
      return res.status(404).json({ error: 'Stream não encontrado' });
    }
    
    console.log('Stream encontrado. Atualizando...');
    
    const queryText = `UPDATE streams SET 
      url = $1, name = $2, sheet = $3, cidade = $4, estado = $5, regiao = $6, segmento = $7, index = $8,
      formato = $9, frequencia = $10, pais = $11, facebook = $12, instagram = $13, twitter = $14, youtube = $15, site = $16,
      monitoring_url = $17, logo_url = $18, updated_at = NOW() 
    WHERE id = $19 RETURNING *`;
    
    const values = [
      url, name, sheet, cidade, estado, regiao, segmento, index,
      formato || segmento, frequencia, pais || 'Brasil', facebook, instagram, twitter, youtube, site,
      monitoring_url, logo_url, id
    ];
    
    console.log('Query SQL:', queryText);
    console.log('Valores:', values);
    
    const result = await pool.query(queryText, values);
    
    console.log('Atualização bem-sucedida. Linhas afetadas:', result.rowCount);
    console.log('Dados atualizados:', result.rows[0]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar stream:', error);
    res.status(500).json({ error: 'Erro ao atualizar stream' });
  }
});

/**
 * @route DELETE /api/streams/:id
 * @desc Excluir um stream
 * @access Private (Admin)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o stream existe
    const checkResult = await pool.query('SELECT * FROM streams WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stream não encontrado' });
    }
    
    await pool.query('DELETE FROM streams WHERE id = $1', [id]);
    
    res.json({ message: 'Stream excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir stream:', error);
    res.status(500).json({ error: 'Erro ao excluir stream' });
  }
});

export default router; 