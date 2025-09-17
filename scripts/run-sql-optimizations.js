import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: 'songmetrix.com.br',
  database: 'music_log',
  password: 'Conquista@@2',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runOptimizations() {
  console.log('🚀 EXECUTANDO OTIMIZAÇÕES SQL DO DASHBOARD');
  console.log('=========================================\n');

  const optimizations = [
    {
      name: 'Remover índices problemáticos',
      sql: 'DROP INDEX IF EXISTS idx_streams_status;'
    },
    {
      name: 'Índice de data em music_log',
      sql: 'CREATE INDEX IF NOT EXISTS idx_music_log_date ON music_log(date);'
    },
    {
      name: 'Índice de nome em music_log',
      sql: 'CREATE INDEX IF NOT EXISTS idx_music_log_name ON music_log(name);'
    },
    {
      name: 'Índice de artista em music_log',
      sql: 'CREATE INDEX IF NOT EXISTS idx_music_log_artist ON music_log(artist);'
    },
    {
      name: 'Índice de gênero em music_log',
      sql: 'CREATE INDEX IF NOT EXISTS idx_music_log_genre ON music_log(genre) WHERE genre IS NOT NULL AND genre <> \'\';'
    },
    {
      name: 'Índice de título da música em music_log',
      sql: 'CREATE INDEX IF NOT EXISTS idx_music_log_song_title ON music_log(song_title);'
    },
    {
      name: 'Índice composto data + nome',
      sql: 'CREATE INDEX IF NOT EXISTS idx_music_log_date_name ON music_log(date, name);'
    },
    {
      name: 'Índice composto data + artista',
      sql: 'CREATE INDEX IF NOT EXISTS idx_music_log_date_artist ON music_log(date, artist);'
    },
    {
      name: 'Índice composto data + gênero',
      sql: 'CREATE INDEX IF NOT EXISTS idx_music_log_date_genre ON music_log(date, genre) WHERE genre IS NOT NULL AND genre <> \'\';'
    },
    {
      name: 'Índice composto música + artista',
      sql: 'CREATE INDEX IF NOT EXISTS idx_music_log_song_artist ON music_log(song_title, artist);'
    },
    {
      name: 'Índice de segmento em streams',
      sql: 'CREATE INDEX IF NOT EXISTS idx_streams_segmento ON streams(segmento);'
    },
    {
      name: 'Índice de nome em streams',
      sql: 'CREATE INDEX IF NOT EXISTS idx_streams_name ON streams(name);'
    },
    {
      name: 'Índice composto segmento + nome em streams',
      sql: 'CREATE INDEX IF NOT EXISTS idx_streams_segmento_name ON streams(segmento, name);'
    },
    {
      name: 'Índice de cobertura para artistas',
      sql: 'CREATE INDEX IF NOT EXISTS idx_music_log_artist_covering ON music_log(artist, date) INCLUDE (song_title);'
    },
    {
      name: 'Índice de cobertura para músicas',
      sql: 'CREATE INDEX IF NOT EXISTS idx_music_log_song_covering ON music_log(song_title, artist, date);'
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const optimization of optimizations) {
    try {
      console.log(`📝 Executando: ${optimization.name}`);
      await pool.query(optimization.sql);
      console.log(`   ✅ Sucesso`);
      successCount++;
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n2️⃣ ATUALIZANDO ESTATÍSTICAS...');
  try {
    await pool.query('ANALYZE music_log;');
    await pool.query('ANALYZE streams;');
    console.log('   ✅ Estatísticas atualizadas');
  } catch (error) {
    console.log(`   ❌ Erro ao atualizar estatísticas: ${error.message}`);
  }

  console.log('\n3️⃣ VERIFICANDO ÍNDICES CRIADOS...');
  try {
    const indexQuery = `
      SELECT
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('music_log', 'streams')
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `;
    
    const result = await pool.query(indexQuery);
    console.log('   Índices criados:');
    result.rows.forEach(row => {
      console.log(`      ${row.tablename}.${row.indexname} (${row.index_size})`);
    });
  } catch (error) {
    console.log(`   ❌ Erro ao verificar índices: ${error.message}`);
  }

  console.log('\n📊 RESUMO:');
  console.log(`   ✅ Sucessos: ${successCount}`);
  console.log(`   ❌ Erros: ${errorCount}`);
  console.log('\n🎯 Otimizações concluídas!');

  await pool.end();
}

runOptimizations().catch(console.error);