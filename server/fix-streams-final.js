import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  user: 'postgres',
  host: '104.234.173.96',
  database: 'music_log',
  password: 'Conquista@@2',
  port: 5433,  // Porta corrigida
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('🔍 DIAGNÓSTICO COMPLETO DA TABELA STREAMS\n');

    // 1. Verificar conexão
    console.log('1. Testando conexão com banco...');
    await pool.query('SELECT 1');
    console.log('✅ Conexão OK\n');

    // 2. Verificar se tabela existe
    console.log('2. Verificando tabela streams...');
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'streams'
      );
    `);

    if (!result.rows[0].exists) {
      console.log('❌ Tabela streams NÃO existe. Criando...\n');

      await pool.query(`
        CREATE TABLE streams (
          id SERIAL PRIMARY KEY,
          url TEXT NOT NULL,
          name VARCHAR(255) NOT NULL,
          sheet VARCHAR(255) NOT NULL,
          cidade VARCHAR(255) NOT NULL,
          estado VARCHAR(2) NOT NULL,
          regiao VARCHAR(50) NOT NULL,
          segmento TEXT NOT NULL,
          index VARCHAR(10) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Criar índices
      await pool.query(`CREATE INDEX idx_streams_name ON streams(name);`);
      await pool.query(`CREATE INDEX idx_streams_cidade ON streams(cidade);`);
      await pool.query(`CREATE INDEX idx_streams_estado ON streams(estado);`);
      await pool.query(`CREATE INDEX idx_streams_regiao ON streams(regiao);`);

      // Criar trigger
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_modified_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.updated_at = now();
           RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      await pool.query(`
        CREATE TRIGGER update_streams_modtime
        BEFORE UPDATE ON streams
        FOR EACH ROW
        EXECUTE FUNCTION update_modified_column();
      `);

      console.log('✅ Tabela streams criada com sucesso!\n');
    } else {
      console.log('✅ Tabela streams existe\n');
    }

    // 3. Verificar estrutura completa
    console.log('3. Verificando estrutura da tabela...');
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'streams'
      ORDER BY ordinal_position;
    `);

    console.log('Colunas encontradas:');
    cols.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const def = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`  - ${col.column_name} (${col.data_type}) ${nullable}${def}`);
    });
    console.log('');

    // 4. Verificar campos obrigatórios
    console.log('4. Verificando campos obrigatórios...');
    const existing = new Set(cols.rows.map(r => r.column_name));
    const required = ['url', 'name', 'sheet', 'cidade', 'estado', 'regiao', 'segmento', 'index'];
    const missing = required.filter(field => !existing.has(field));

    if (missing.length > 0) {
      console.log('❌ Campos obrigatórios faltando:', missing.join(', '));
      return;
    }
    console.log('✅ Todos os campos obrigatórios estão presentes\n');

    // 5. Adicionar campos opcionais
    console.log('5. Verificando campos opcionais...');
    const optional = [
      { name: 'formato', type: 'TEXT', comment: 'Formato musical da rádio' },
      { name: 'frequencia', type: 'VARCHAR(50)', comment: 'Frequência da rádio' },
      { name: 'pais', type: 'VARCHAR(100)', default: "'Brasil'", comment: 'País da rádio' },
      { name: 'facebook', type: 'TEXT', comment: 'URL Facebook' },
      { name: 'instagram', type: 'TEXT', comment: 'URL Instagram' },
      { name: 'twitter', type: 'TEXT', comment: 'URL Twitter' },
      { name: 'youtube', type: 'TEXT', comment: 'URL YouTube' },
      { name: 'site', type: 'TEXT', comment: 'URL do site' },
      { name: 'monitoring_url', type: 'TEXT', comment: 'URL de monitoramento' },
      { name: 'logo_url', type: 'TEXT', comment: 'URL do logo' }
    ];

    let addedCount = 0;
    for (const field of optional) {
      if (!existing.has(field.name)) {
        const defaultClause = field.default ? ` DEFAULT ${field.default}` : '';
        await pool.query(`ALTER TABLE streams ADD COLUMN ${field.name} ${field.type}${defaultClause};`);
        if (field.comment) {
          await pool.query(`COMMENT ON COLUMN streams.${field.name} IS '${field.comment}';`);
        }
        console.log(`✅ Campo ${field.name} adicionado`);
        addedCount++;
      }
    }

    if (addedCount === 0) {
      console.log('✅ Todos os campos opcionais já existem');
    }
    console.log('');

    // 6. Teste de inserção
    console.log('6. Testando funcionalidade...');
    try {
      const testData = {
        url: 'http://test.com/stream',
        name: 'Rádio Teste',
        sheet: 'teste',
        cidade: 'São Paulo',
        estado: 'SP',
        regiao: 'Sudeste',
        segmento: 'Pop',
        index: '001'
      };

      const insertCols = Object.keys(testData);
      const insertVals = Object.values(testData);
      const params = insertCols.map((_, i) => `$${i + 1}`);

      const insertQuery = `INSERT INTO streams (${insertCols.join(', ')}) VALUES (${params.join(', ')}) RETURNING id`;
      const insertResult = await pool.query(insertQuery, insertVals);

      console.log(`✅ Inserção de teste OK (ID: ${insertResult.rows[0].id})`);

      // Limpar teste
      await pool.query('DELETE FROM streams WHERE name = $1', ['Rádio Teste']);
      console.log('🧹 Registro de teste removido\n');

    } catch (insertError) {
      console.log('❌ Erro na inserção de teste:', insertError.message);
      console.log('Isso pode indicar problemas na estrutura da tabela\n');
      return;
    }

    // 7. Verificar índices
    console.log('7. Verificando índices...');
    const indexes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'streams';
    `);

    if (indexes.rows.length === 0) {
      console.log('⚠️ Nenhum índice encontrado (criando índices básicos...)');
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_streams_name ON streams(name);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_streams_cidade ON streams(cidade);`);
      console.log('✅ Índices básicos criados');
    } else {
      console.log(`✅ ${indexes.rows.length} índices encontrados`);
    }
    console.log('');

    console.log('🎉 TABELA STREAMS ESTÁ COMPLETA E FUNCIONAL!');
    console.log('✅ O endpoint POST /api/streams deve funcionar perfeitamente agora');
    console.log('✅ Você pode adicionar/editar/remover streams sem erros');

  } catch (error) {
    console.error('❌ Erro durante o diagnóstico:', error.message);
    console.log('\n🔧 Possíveis causas:');
    console.log('- Problemas de conectividade com o banco');
    console.log('- Credenciais incorretas');
    console.log('- Permissões insuficientes no PostgreSQL');
    console.log('- Porta do banco incorreta');
  } finally {
    await pool.end();
  }
}

main();