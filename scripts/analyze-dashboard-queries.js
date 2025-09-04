#!/usr/bin/env node

/**
 * Script to analyze dashboard queries performance and identify optimization opportunities
 */

import pkg from 'pg';
import dotenv from 'dotenv';
import { format } from 'date-fns';

const { Pool } = pkg;

// Load environment variables
dotenv.config();

async function analyzeDashboardQueries() {
  const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 ANALYZING DASHBOARD QUERIES PERFORMANCE\n');
    console.log('==========================================\n');

    // 1. Check table structures and sizes
    console.log('1️⃣ CHECKING TABLE STRUCTURES AND SIZES...');
    
    const tablesQuery = `
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_stat_get_tuples_returned(c.oid) as tuples_returned,
        pg_stat_get_tuples_fetched(c.oid) as tuples_fetched
      FROM pg_tables pt
      JOIN pg_class c ON c.relname = pt.tablename
      WHERE schemaname = 'public' 
        AND tablename IN ('music_log', 'streams')
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    console.log('   Table sizes and access patterns:');
    tablesResult.rows.forEach(row => {
      console.log(`      ${row.tablename}: ${row.size} (${row.tuples_returned} returned, ${row.tuples_fetched} fetched)`);
    });
    console.log('');

    // 2. Check existing indexes
    console.log('2️⃣ CHECKING EXISTING INDEXES...');
    
    const indexesQuery = `
      SELECT 
        t.tablename,
        i.indexname,
        i.indexdef,
        pg_size_pretty(pg_relation_size(i.indexname::regclass)) as index_size
      FROM pg_indexes i
      JOIN pg_tables t ON t.tablename = i.tablename
      WHERE t.schemaname = 'public' 
        AND t.tablename IN ('music_log', 'streams')
      ORDER BY t.tablename, i.indexname;
    `;
    
    const indexesResult = await pool.query(indexesQuery);
    console.log('   Existing indexes:');
    indexesResult.rows.forEach(row => {
      console.log(`      ${row.tablename}.${row.indexname}: ${row.index_size}`);
      console.log(`        ${row.indexdef}`);
    });
    console.log('');

    // 3. Analyze dashboard query performance
    console.log('3️⃣ ANALYZING DASHBOARD QUERY PERFORMANCE...');
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    // Test the main dashboard query with EXPLAIN ANALYZE
    const dashboardQuery = `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      WITH adjusted_dates AS (
        SELECT
          artist,
          song_title,
          genre,
          name,
          (date + INTERVAL '3 hours')::date as adjusted_date
        FROM music_log
        WHERE (date + INTERVAL '3 hours')::date BETWEEN $1 AND $2
      ),
      artist_counts AS (
        SELECT
          artist,
          COUNT(*) as executions
        FROM adjusted_dates
        GROUP BY artist
        ORDER BY executions DESC
        LIMIT 10
      ),
      genre_counts AS (
        SELECT
          genre,
          COUNT(*) as count
        FROM adjusted_dates
        WHERE genre IS NOT NULL AND genre <> ''
        GROUP BY genre
        HAVING COUNT(*) > 0
        ORDER BY count DESC
        LIMIT 5
      ),
      song_counts AS (
        SELECT 
          song_title,
          artist,
          COUNT(*) as executions
        FROM adjusted_dates
        GROUP BY song_title, artist
        ORDER BY executions DESC
        LIMIT 10
      )
      SELECT
        json_build_object(
          'artistData', (SELECT json_agg(artist_counts.*) FROM artist_counts WHERE artist_counts.artist IS NOT NULL),
          'genreData', (SELECT json_agg(genre_counts.*) FROM genre_counts WHERE genre_counts.genre IS NOT NULL),
          'topSongs', (SELECT json_agg(song_counts.*) FROM song_counts WHERE song_counts.song_title IS NOT NULL)
        ) as dashboard_data
    `;

    const queryParams = [
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd')
    ];

    console.log('   Analyzing main dashboard query...');
    const explainResult = await pool.query(dashboardQuery, queryParams);
    const queryPlan = explainResult.rows[0]['QUERY PLAN'][0];
    
    console.log(`   Execution Time: ${queryPlan['Execution Time']}ms`);
    console.log(`   Planning Time: ${queryPlan['Planning Time']}ms`);
    console.log(`   Total Time: ${queryPlan['Execution Time'] + queryPlan['Planning Time']}ms`);
    console.log('');

    // 4. Check for missing indexes
    console.log('4️⃣ CHECKING FOR MISSING INDEXES...');
    
    // Check if date column has index
    const dateIndexQuery = `
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'music_log' 
        AND indexdef LIKE '%date%';
    `;
    
    const dateIndexResult = await pool.query(dateIndexQuery);
    console.log(`   Date indexes on music_log: ${dateIndexResult.rows.length}`);
    dateIndexResult.rows.forEach(row => {
      console.log(`      ${row.indexname}: ${row.indexdef}`);
    });

    // Check if name column has index
    const nameIndexQuery = `
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'music_log' 
        AND indexdef LIKE '%name%';
    `;
    
    const nameIndexResult = await pool.query(nameIndexQuery);
    console.log(`   Name indexes on music_log: ${nameIndexResult.rows.length}`);
    nameIndexResult.rows.forEach(row => {
      console.log(`      ${row.indexname}: ${row.indexdef}`);
    });
    console.log('');

    // 5. Check query statistics
    console.log('5️⃣ CHECKING QUERY STATISTICS...');
    
    const statsQuery = `
      SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_tup_ins,
        n_tup_upd,
        n_tup_del
      FROM pg_stat_user_tables 
      WHERE tablename IN ('music_log', 'streams');
    `;
    
    const statsResult = await pool.query(statsQuery);
    console.log('   Table access statistics:');
    statsResult.rows.forEach(row => {
      console.log(`      ${row.tablename}:`);
      console.log(`        Sequential scans: ${row.seq_scan} (${row.seq_tup_read} tuples)`);
      console.log(`        Index scans: ${row.idx_scan} (${row.idx_tup_fetch} tuples)`);
      console.log(`        Inserts: ${row.n_tup_ins}, Updates: ${row.n_tup_upd}, Deletes: ${row.n_tup_del}`);
    });
    console.log('');

    // 6. Recommendations
    console.log('6️⃣ OPTIMIZATION RECOMMENDATIONS...');
    console.log('   Based on the analysis, here are the recommended optimizations:');
    
    if (dateIndexResult.rows.length === 0) {
      console.log('   ❌ Missing date index on music_log - CREATE INDEX idx_music_log_date ON music_log(date);');
    }
    
    if (nameIndexResult.rows.length === 0) {
      console.log('   ❌ Missing name index on music_log - CREATE INDEX idx_music_log_name ON music_log(name);');
    }
    
    console.log('   📊 Consider composite indexes for common query patterns');
    console.log('   🔄 Consider materialized views for frequently accessed aggregations');
    console.log('   ⚡ Consider query batching for multiple dashboard requests');
    console.log('');

    console.log('==========================================');
    console.log('🏁 ANALYSIS COMPLETED!');
    console.log('==========================================');

  } catch (error) {
    console.error('💥 Error during analysis:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Execute analysis
analyzeDashboardQueries().then(() => {
  console.log('\n🎯 Analysis finished!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});