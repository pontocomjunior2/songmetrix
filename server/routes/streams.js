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
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false
  }
});

// Cache simples em memória para colunas existentes na tabela
let cachedStreamsColumns = null;
async function getStreamsColumns() {
  if (cachedStreamsColumns) return cachedStreamsColumns;
  try {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'streams'`
    );
    cachedStreamsColumns = new Set(result.rows.map(r => r.column_name));
  } catch (e) {
    console.error('[streams.js] Falha ao obter colunas de streams:', e);
    cachedStreamsColumns = new Set();
  }
  return cachedStreamsColumns;
}

function buildInsertStatement(existingCols, payload) {
  // Map de campos aceitos -> chave no payload
  const fieldOrder = [
    'url', 'name', 'sheet', 'cidade', 'estado', 'regiao', 'segmento', 'index',
    // Campos opcionais (só se existirem na tabela)
    'formato', 'frequencia', 'pais', 'facebook', 'instagram', 'twitter', 'youtube', 'site', 'monitoring_url', 'logo_url'
  ];

  const cols = [];
  const vals = [];
  const params = [];

  fieldOrder.forEach((col) => {
    if (existingCols.has(col) && payload[col] !== undefined && payload[col] !== null) {
      cols.push(col);
      params.push(`$${params.length + 1}`);
      vals.push(payload[col]);
    }
  });

  if (cols.length === 0) {
    throw new Error('Nenhuma coluna válida para inserir.');
  }

  const text = `INSERT INTO streams (${cols.join(', ')}) VALUES (${params.join(', ')}) RETURNING *`;
  return { text, values: vals };
}

function buildUpdateStatement(existingCols, payload, id) {
  const updatable = [
    'url', 'name', 'sheet', 'cidade', 'estado', 'regiao', 'segmento', 'index',
    'formato', 'frequencia', 'pais', 'facebook', 'instagram', 'twitter', 'youtube', 'site', 'monitoring_url', 'logo_url'
  ];

  const sets = [];
  const values = [];

  updatable.forEach((col) => {
    if (existingCols.has(col) && payload[col] !== undefined) {
      sets.push(`${col} = $${values.length + 1}`);
      values.push(payload[col]);
    }
  });

  if (existingCols.has('updated_at')) {
    sets.push(`updated_at = NOW()`);
  }

  if (sets.length === 0) {
    throw new Error('Nenhum campo válido para atualizar.');
  }

  const text = `UPDATE streams SET ${sets.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
  values.push(id);
  return { text, values };
}

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
    const existingCols = await getStreamsColumns();

    const payload = { ...req.body };
    // Defaults mínimos
    if (payload.pais === undefined && existingCols.has('pais')) payload.pais = 'Brasil';
    // Se formato não existir, ignoramos; se existir e nao enviado, podemos preencher com segmento
    if (existingCols.has('formato') && payload.formato == null && payload.segmento != null) {
      payload.formato = payload.segmento;
    }

    // Validação básica (apenas campos que existem na tabela)
    const required = ['url', 'name', 'sheet', 'cidade', 'estado', 'regiao', 'segmento', 'index'];
    const missing = required.filter((k) => (!payload[k] || payload[k] === '') && existingCols.has(k));
    if (missing.length > 0) {
      return res.status(400).json({ error: `Campos obrigatórios faltando: ${missing.join(', ')}` });
    }

    const stmt = buildInsertStatement(existingCols, payload);
    const result = await pool.query(stmt.text, stmt.values);
    return res.status(201).json(result.rows[0]);
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

    const payload = { ...req.body };

    // Verificar se o stream existe e obter o nome atual
    const checkResult = await pool.query('SELECT * FROM streams WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      console.log('Stream não encontrado com ID:', id);
      return res.status(404).json({ error: 'Stream não encontrado' });
    }

    const currentStream = checkResult.rows[0];
    const oldName = currentStream.name;
    const newName = payload.name;

    console.log('Stream encontrado. Atualizando...');
    const existingCols = await getStreamsColumns();
    if (existingCols.has('formato') && payload.formato == null && payload.segmento != null) {
      payload.formato = payload.segmento;
    }

    const stmt = buildUpdateStatement(existingCols, payload, id);
    console.log('Query SQL:', stmt.text);
    console.log('Valores:', stmt.values);
    const result = await pool.query(stmt.text, stmt.values);

    console.log('Atualização bem-sucedida. Linhas afetadas:', result.rowCount);
    console.log('Dados atualizados:', result.rows[0]);

    // Se o nome da rádio foi alterado, atualizar também os registros na music_log
    if (newName && oldName !== newName) {
      console.log(`Nome da rádio alterado de "${oldName}" para "${newName}". Atualizando music_log...`);

      try {
        const updateMusicLogQuery = `
          UPDATE music_log
          SET name = $1
          WHERE name = $2
        `;
        const musicLogResult = await pool.query(updateMusicLogQuery, [newName, oldName]);

        console.log(`${musicLogResult.rowCount} registros na music_log atualizados do nome "${oldName}" para "${newName}"`);
      } catch (musicLogError) {
        console.error('Erro ao atualizar music_log:', musicLogError);
        // Não falhar a operação principal por causa deste erro
      }
    }

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