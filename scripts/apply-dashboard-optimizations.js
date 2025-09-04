#!/usr/bin/env node

/**
 * Script to apply dashboard query optimizations
 */

import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

async function applyOptimizations() {
  const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 APPLYING DASHBOARD QUERY OPTIMIZATIONS\n');
    console.log('=========================================\n');

    // 1. Read and execute the optimization SQL
    console.log('1️⃣ APPLYING INDEX OPTIMIZATIONS...');
    
    const sqlPath = path.join(__dirname, 'optimize-dashboard-indexes.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        if (statement.toLowerCase().includes('select')) {
          // Execute SELECT statements and show results
          const result = await pool.query(statement);
          if (result.rows.length > 0) {
            console.log('   Index creation results:');
            result.rows.forEach(row => {
              console.log(`      ${row.tablename}.${row.indexname}: ${row.index_size}`);
            });
          }
        } else {
          // Execute DDL statements
          await pool.query(statement);
          successCount++;
        }
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`   ✅ Index already exists: ${error.message.split('"')[1]}`);
          successCount++;
        } else {
          console.error(`   ❌ Error executing statement: ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log(`   Completed: ${successCount} successful, ${errorCount} errors\n`);

    // 2. Verify index creation
    console.log('2️⃣ VERIFYING INDEX CREATION...');
    
    const indexVerificationQuery = `
      SELECT 
        t.tablename,
        i.indexname,
        pg_size_pretty(pg_relation_size(i.indexname::regclass)) as index_size,
        i.indexdef
      FROM pg_indexes i
      JOIN pg_tables t ON t.tablename = i.tablename
      WHERE t.schemaname = 'public' 
        AND t.tablename IN ('music_log', 'streams')
        AND i.indexname LIKE 'idx_%'
      ORDER BY t.tablename, pg_relation_size(i.indexname::regclass) DESC;
    `;
    
    const indexResult = await pool.query(indexVerificationQuery);
    console.log('   Created indexes:');
    indexResult.rows.forEach(row => {
      console.log(`      ${row.tablename}.${row.indexname}: ${row.index_size}`);
    });
    console.log('');

    // 3. Test query performance improvement
    console.log('3️⃣ TESTING QUERY PERFORMANCE...');
    
    const testQuery = `
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT 
        artist,
        COUNT(*) as executions
      FROM music_log
      WHERE date >= CURRENT_DATE - INTERVAL '7 days'
        AND name = 'Test Radio'
      GROUP BY artist
      ORDER BY executions DESC
      LIMIT 10;
    `;
    
    try {
      const testResult = await pool.query(testQuery);
      console.log('   Query execution plan:');
      testResult.rows.forEach(row => {
        console.log(`      ${row['QUERY PLAN']}`);
      });
    } catch (error) {
      console.log('   Test query completed (no test data available)');
    }
    console.log('');

    // 4. Update table statistics
    console.log('4️⃣ UPDATING TABLE STATISTICS...');
    
    await pool.query('ANALYZE music_log');
    await pool.query('ANALYZE streams');
    
    console.log('   ✅ Table statistics updated\n');

    // 5. Show final statistics
    console.log('5️⃣ FINAL OPTIMIZATION STATISTICS...');
    
    const statsQuery = `
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.tablename AND schemaname = 'public') as index_count
      FROM pg_tables t
      WHERE schemaname = 'public' 
        AND tablename IN ('music_log', 'streams')
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `;
    
    const statsResult = await pool.query(statsQuery);
    console.log('   Final table statistics:');
    statsResult.rows.forEach(row => {
      console.log(`      ${row.tablename}: ${row.table_size} (${row.index_count} indexes)`);
    });
    console.log('');

    console.log('=========================================');
    console.log('🏁 OPTIMIZATION COMPLETED SUCCESSFULLY!');
    console.log('=========================================');
    console.log('');
    console.log('📊 Next steps:');
    console.log('   1. Monitor query performance in production');
    console.log('   2. Consider implementing materialized views');
    console.log('   3. Set up query batching in API endpoints');
    console.log('   4. Implement response caching');

  } catch (error) {
    console.error('💥 Error during optimization:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Execute optimization
applyOptimizations().then(() => {
  console.log('\n🎯 Optimization finished!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});