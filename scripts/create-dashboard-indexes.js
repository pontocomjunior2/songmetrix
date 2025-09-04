#!/usr/bin/env node

/**
 * Script to create essential indexes for dashboard performance
 */

import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

// Load environment variables
dotenv.config();

async function createDashboardIndexes() {
  const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 CREATING DASHBOARD PERFORMANCE INDEXES\n');
    console.log('=========================================\n');

    // Define indexes to create
    const indexes = [
      {
        name: 'idx_music_log_date',
        table: 'music_log',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_music_log_date ON music_log(date)',
        description: 'Date filtering for dashboard queries'
      },
      {
        name: 'idx_music_log_name',
        table: 'music_log', 
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_music_log_name ON music_log(name)',
        description: 'Radio name filtering'
      },
      {
        name: 'idx_music_log_artist',
        table: 'music_log',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_music_log_artist ON music_log(artist)',
        description: 'Artist aggregations'
      },
      {
        name: 'idx_music_log_genre',
        table: 'music_log',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_music_log_genre ON music_log(genre) WHERE genre IS NOT NULL AND genre <> \'\'',
        description: 'Genre aggregations (excluding nulls)'
      },
      {
        name: 'idx_music_log_song_title',
        table: 'music_log',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_music_log_song_title ON music_log(song_title)',
        description: 'Song title aggregations'
      },
      {
        name: 'idx_music_log_date_name_composite',
        table: 'music_log',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_music_log_date_name_composite ON music_log(date, name)',
        description: 'Composite index for date + radio filtering'
      },
      {
        name: 'idx_streams_segmento',
        table: 'streams',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streams_segmento ON streams(segmento)',
        description: 'Segment filtering for user preferences'
      }
    ];

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Check existing indexes first
    console.log('1️⃣ CHECKING EXISTING INDEXES...');
    const existingIndexesQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename IN ('music_log', 'streams')
    `;
    
    const existingResult = await pool.query(existingIndexesQuery);
    const existingIndexes = existingResult.rows.map(row => row.indexname);
    
    console.log(`   Found ${existingIndexes.length} existing indexes\n`);

    // Create indexes
    console.log('2️⃣ CREATING NEW INDEXES...');
    
    for (const index of indexes) {
      try {
        if (existingIndexes.includes(index.name)) {
          console.log(`   ⏭️  Skipping ${index.name} (already exists)`);
          skipCount++;
          continue;
        }

        console.log(`   🔨 Creating ${index.name}...`);
        console.log(`      ${index.description}`);
        
        const startTime = Date.now();
        await pool.query(index.definition);
        const duration = Date.now() - startTime;
        
        console.log(`   ✅ Created ${index.name} (${duration}ms)`);
        successCount++;
        
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`   ⏭️  ${index.name} already exists`);
          skipCount++;
        } else {
          console.error(`   ❌ Error creating ${index.name}: ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log(`\n   Summary: ${successCount} created, ${skipCount} skipped, ${errorCount} errors\n`);

    // Verify created indexes
    console.log('3️⃣ VERIFYING CREATED INDEXES...');
    
    const verifyQuery = `
      SELECT 
        i.tablename,
        i.indexname,
        pg_size_pretty(pg_relation_size(i.indexname::regclass)) as size
      FROM pg_indexes i
      WHERE i.schemaname = 'public' 
        AND i.tablename IN ('music_log', 'streams')
        AND i.indexname LIKE 'idx_%'
      ORDER BY i.tablename, i.indexname
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    console.log('   Dashboard indexes:');
    verifyResult.rows.forEach(row => {
      console.log(`      ${row.tablename}.${row.indexname}: ${row.size}`);
    });
    console.log('');

    // Update statistics
    console.log('4️⃣ UPDATING TABLE STATISTICS...');
    await pool.query('ANALYZE music_log');
    await pool.query('ANALYZE streams');
    console.log('   ✅ Statistics updated\n');

    // Performance test
    console.log('5️⃣ TESTING INDEX PERFORMANCE...');
    
    const testQueries = [
      {
        name: 'Date range query',
        query: `
          EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
          SELECT COUNT(*) 
          FROM music_log 
          WHERE date >= CURRENT_DATE - INTERVAL '7 days'
        `
      },
      {
        name: 'Artist aggregation',
        query: `
          EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
          SELECT artist, COUNT(*) 
          FROM music_log 
          WHERE date >= CURRENT_DATE - INTERVAL '7 days'
          GROUP BY artist 
          ORDER BY COUNT(*) DESC 
          LIMIT 5
        `
      }
    ];

    for (const test of testQueries) {
      try {
        console.log(`   Testing: ${test.name}`);
        const result = await pool.query(test.query);
        
        // Find execution time in the plan
        const planText = result.rows.map(row => row['QUERY PLAN']).join('\n');
        const executionTimeMatch = planText.match(/Execution Time: ([\d.]+) ms/);
        
        if (executionTimeMatch) {
          console.log(`   ⚡ Execution time: ${executionTimeMatch[1]}ms`);
        }
        
        // Check if indexes are being used
        if (planText.includes('Index Scan') || planText.includes('Index Only Scan')) {
          console.log(`   ✅ Using indexes`);
        } else if (planText.includes('Seq Scan')) {
          console.log(`   ⚠️  Using sequential scan`);
        }
        
      } catch (error) {
        console.log(`   ❌ Test failed: ${error.message}`);
      }
    }

    console.log('\n=========================================');
    console.log('🏁 INDEX CREATION COMPLETED!');
    console.log('=========================================');
    console.log('\n📈 Performance improvements expected:');
    console.log('   • Faster date-based filtering');
    console.log('   • Improved artist/song aggregations');
    console.log('   • Better radio name filtering');
    console.log('   • Optimized segment-based queries');

  } catch (error) {
    console.error('💥 Error during index creation:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Execute index creation
createDashboardIndexes().then(() => {
  console.log('\n🎯 Index creation finished!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});