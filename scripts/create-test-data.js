import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
const envPaths = [
  path.join(dirname(__dirname), '.env.production'),
  path.join(dirname(__dirname), '.env'),
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (result.error === undefined) {
    console.log('✅ Loaded environment variables from:', envPath);
    break;
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Pool PostgreSQL para dados de teste
const pgPool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createTestData() {
  try {
    console.log('🏗️  Criando dados de teste para InsightGeneratorService\n');

    // 1. Criar usuários de teste
    console.log('👥 Criando usuários de teste...');
    
    const testUsers = [
      {
        id: 'test-user-1',
        email: 'teste1@songmetrix.com'
      },
      {
        id: 'test-user-2', 
        email: 'teste2@songmetrix.com'
      },
      {
        id: 'test-user-3',
        email: 'teste3@songmetrix.com'
      }
    ];

    for (const user of testUsers) {
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          status: 'ATIVO',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (userError && userError.code !== '23505') { // Ignorar erro de duplicata
        console.error(`❌ Erro ao criar usuário ${user.email}:`, userError);
      } else {
        console.log(`✅ Usuário criado: ${user.email}`);
      }
    }

    // 2. Verificar se as tabelas de música existem
    console.log('\n🎵 Verificando tabelas de música...');
    
    const client = await pgPool.connect();
    
    try {
      // Verificar se a tabela songs existe
      const songsTableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'songs'
        );
      `);

      const songsTableExists = songsTableCheck.rows[0].exists;

      if (!songsTableExists) {
        console.log('📝 Criando tabela songs...');
        await client.query(`
          CREATE TABLE IF NOT EXISTS songs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `);
      }

      // Verificar se a tabela music_plays existe
      const playsTableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'music_plays'
        );
      `);

      const playsTableExists = playsTableCheck.rows[0].exists;

      if (!playsTableExists) {
        console.log('📝 Criando tabela music_plays...');
        await client.query(`
          CREATE TABLE IF NOT EXISTS music_plays (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            song_id UUID REFERENCES songs(id),
            user_id UUID REFERENCES users(id),
            played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `);
      }

      // 3. Criar músicas de teste
      console.log('\n🎶 Criando músicas de teste...');
      
      const testSongs = [
        { title: 'Envolver', artist: 'Anitta' },
        { title: 'As It Was', artist: 'Harry Styles' },
        { title: 'Heat Waves', artist: 'Glass Animals' },
        { title: 'Stay', artist: 'The Kid LAROI & Justin Bieber' },
        { title: 'Good 4 U', artist: 'Olivia Rodrigo' },
        { title: 'Peaches', artist: 'Justin Bieber' },
        { title: 'Levitating', artist: 'Dua Lipa' },
        { title: 'Blinding Lights', artist: 'The Weeknd' },
        { title: 'Watermelon Sugar', artist: 'Harry Styles' },
        { title: 'Drivers License', artist: 'Olivia Rodrigo' }
      ];

      const songIds = [];

      for (const song of testSongs) {
        const result = await client.query(`
          INSERT INTO songs (title, artist) 
          VALUES ($1, $2) 
          ON CONFLICT DO NOTHING
          RETURNING id;
        `, [song.title, song.artist]);

        if (result.rows.length > 0) {
          songIds.push(result.rows[0].id);
          console.log(`✅ Música criada: ${song.title} - ${song.artist}`);
        } else {
          // Buscar ID da música existente
          const existingResult = await client.query(`
            SELECT id FROM songs WHERE title = $1 AND artist = $2;
          `, [song.title, song.artist]);
          
          if (existingResult.rows.length > 0) {
            songIds.push(existingResult.rows[0].id);
          }
        }
      }

      // 4. Criar dados de execução com padrão de crescimento
      console.log('\n📊 Criando dados de execução com padrão de crescimento...');

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      for (const userId of testUsers.map(u => u.id)) {
        // Música com crescimento significativo
        const growthSongId = songIds[0]; // Envolver - Anitta
        
        // Semana passada: 15 execuções
        for (let i = 0; i < 15; i++) {
          const randomTime = new Date(
            twoWeeksAgo.getTime() + Math.random() * (oneWeekAgo.getTime() - twoWeeksAgo.getTime())
          );
          
          await client.query(`
            INSERT INTO music_plays (song_id, user_id, played_at)
            VALUES ($1, $2, $3);
          `, [growthSongId, userId, randomTime]);
        }

        // Esta semana: 45 execuções (crescimento de 3x)
        for (let i = 0; i < 45; i++) {
          const randomTime = new Date(
            oneWeekAgo.getTime() + Math.random() * (now.getTime() - oneWeekAgo.getTime())
          );
          
          await client.query(`
            INSERT INTO music_plays (song_id, user_id, played_at)
            VALUES ($1, $2, $3);
          `, [growthSongId, userId, randomTime]);
        }

        // Outras músicas com execuções normais
        for (let i = 1; i < Math.min(songIds.length, 5); i++) {
          const songId = songIds[i];
          const playsCount = Math.floor(Math.random() * 20) + 5;
          
          for (let j = 0; j < playsCount; j++) {
            const randomTime = new Date(
              twoWeeksAgo.getTime() + Math.random() * (now.getTime() - twoWeeksAgo.getTime())
            );
            
            await client.query(`
              INSERT INTO music_plays (song_id, user_id, played_at)
              VALUES ($1, $2, $3);
            `, [songId, userId, randomTime]);
          }
        }

        console.log(`✅ Dados de execução criados para usuário ${userId}`);
      }

      console.log('\n📈 Resumo dos dados criados:');
      
      // Verificar dados criados
      const statsResult = await client.query(`
        SELECT 
          COUNT(DISTINCT s.id) as total_songs,
          COUNT(DISTINCT mp.user_id) as total_users,
          COUNT(*) as total_plays
        FROM songs s
        CROSS JOIN music_plays mp ON mp.song_id = s.id;
      `);

      if (statsResult.rows.length > 0) {
        const stats = statsResult.rows[0];
        console.log(`   🎵 Músicas: ${stats.total_songs}`);
        console.log(`   👥 Usuários: ${stats.total_users}`);
        console.log(`   ▶️  Execuções: ${stats.total_plays}`);
      }

      // Mostrar exemplo de crescimento
      const growthExample = await client.query(`
        WITH weekly_plays AS (
          SELECT 
            s.title,
            s.artist,
            EXTRACT(WEEK FROM mp.played_at) as week_number,
            COUNT(*) as plays
          FROM music_plays mp
          JOIN songs s ON s.id = mp.song_id
          WHERE mp.played_at >= NOW() - INTERVAL '2 weeks'
          GROUP BY s.id, s.title, s.artist, week_number
        )
        SELECT 
          title,
          artist,
          MAX(CASE WHEN week_number = EXTRACT(WEEK FROM NOW()) THEN plays END) as current_week,
          MAX(CASE WHEN week_number = EXTRACT(WEEK FROM NOW()) - 1 THEN plays END) as previous_week
        FROM weekly_plays
        GROUP BY title, artist
        HAVING MAX(CASE WHEN week_number = EXTRACT(WEEK FROM NOW()) - 1 THEN plays END) > 10
        ORDER BY (MAX(CASE WHEN week_number = EXTRACT(WEEK FROM NOW()) THEN plays END)::float / 
                 MAX(CASE WHEN week_number = EXTRACT(WEEK FROM NOW()) - 1 THEN plays END)) DESC
        LIMIT 3;
      `);

      if (growthExample.rows.length > 0) {
        console.log('\n📊 Exemplos de crescimento detectados:');
        growthExample.rows.forEach((row, index) => {
          const growth = row.current_week / row.previous_week;
          console.log(`   ${index + 1}. ${row.title} - ${row.artist}`);
          console.log(`      📈 ${row.previous_week} → ${row.current_week} execuções (${growth.toFixed(2)}x)`);
        });
      }

    } finally {
      client.release();
    }

    console.log('\n🎉 Dados de teste criados com sucesso!');
    console.log('\n💡 Próximos passos:');
    console.log('   1. Execute: npm run test-insight-generator');
    console.log('   2. Verifique os insights gerados na tabela generated_insight_emails');
    console.log('   3. Teste o LlmService com os dados reais');

  } catch (error) {
    console.error('❌ Erro ao criar dados de teste:', error);
    console.error('Stack:', error.stack);
  } finally {
    await pgPool.end();
  }
}

// Executar criação de dados de teste
createTestData();