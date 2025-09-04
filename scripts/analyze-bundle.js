#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function analyzeBundleSize() {
  log('\n🔍 Analyzing bundle size...', 'cyan');
  
  const distPath = path.join(process.cwd(), 'dist');
  
  if (!fs.existsSync(distPath)) {
    log('❌ Dist folder not found. Please run "npm run build" first.', 'red');
    process.exit(1);
  }

  // Get all files in dist directory
  function getFilesRecursively(dir) {
    const files = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...getFilesRecursively(fullPath));
      } else {
        files.push({
          path: fullPath,
          relativePath: path.relative(distPath, fullPath),
          size: stat.size,
          ext: path.extname(item),
        });
      }
    }
    
    return files;
  }

  const files = getFilesRecursively(distPath);
  
  // Group files by type
  const filesByType = {
    js: files.filter(f => f.ext === '.js'),
    css: files.filter(f => f.ext === '.css'),
    html: files.filter(f => f.ext === '.html'),
    images: files.filter(f => /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(f.ext)),
    fonts: files.filter(f => /\.(woff|woff2|ttf|eot)$/i.test(f.ext)),
    other: files.filter(f => !/\.(js|css|html|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot)$/i.test(f.ext)),
  };

  // Calculate totals
  const totals = {};
  for (const [type, typeFiles] of Object.entries(filesByType)) {
    totals[type] = typeFiles.reduce((sum, file) => sum + file.size, 0);
  }

  const totalSize = Object.values(totals).reduce((sum, size) => sum + size, 0);

  // Display results
  log('\n📊 Bundle Analysis Results:', 'bright');
  log('═'.repeat(50), 'blue');
  
  log(`\n📦 Total Bundle Size: ${formatBytes(totalSize)}`, 'bright');
  
  for (const [type, size] of Object.entries(totals)) {
    if (size > 0) {
      const percentage = ((size / totalSize) * 100).toFixed(1);
      log(`  ${type.toUpperCase().padEnd(8)}: ${formatBytes(size).padEnd(10)} (${percentage}%)`, 'cyan');
    }
  }

  // Show largest files
  log('\n🔍 Largest Files:', 'bright');
  log('─'.repeat(50), 'blue');
  
  const largestFiles = files
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  for (const file of largestFiles) {
    const percentage = ((file.size / totalSize) * 100).toFixed(1);
    log(`  ${file.relativePath.padEnd(30)}: ${formatBytes(file.size).padEnd(10)} (${percentage}%)`, 'yellow');
  }

  // Performance recommendations
  log('\n💡 Performance Recommendations:', 'bright');
  log('─'.repeat(50), 'blue');

  const jsSize = totals.js;
  const cssSize = totals.css;
  const imageSize = totals.images;

  if (jsSize > 1024 * 1024) { // 1MB
    log('  ⚠️  JavaScript bundle is large. Consider code splitting.', 'yellow');
  }

  if (cssSize > 100 * 1024) { // 100KB
    log('  ⚠️  CSS bundle is large. Consider removing unused styles.', 'yellow');
  }

  if (imageSize > 500 * 1024) { // 500KB
    log('  ⚠️  Images are large. Consider optimization and WebP format.', 'yellow');
  }

  const mainJsFiles = filesByType.js.filter(f => f.relativePath.includes('main') || f.relativePath.includes('index'));
  if (mainJsFiles.length > 0 && mainJsFiles[0].size > 500 * 1024) { // 500KB
    log('  ⚠️  Main bundle is large. Ensure proper code splitting.', 'yellow');
  }

  if (totalSize < 2 * 1024 * 1024) { // 2MB
    log('  ✅ Bundle size is within acceptable limits.', 'green');
  }

  log('\n✨ Analysis complete!', 'green');
  
  // Check if bundle analysis HTML exists
  const analysisPath = path.join(distPath, 'bundle-analysis.html');
  if (fs.existsSync(analysisPath)) {
    log(`\n🌐 Detailed analysis available at: ${analysisPath}`, 'cyan');
    log('   Open this file in your browser for interactive bundle analysis.', 'cyan');
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    log('\n📦 Bundle Analyzer', 'bright');
    log('Analyzes the built bundle and provides performance insights.\n', 'cyan');
    log('Usage:', 'bright');
    log('  npm run analyze-bundle', 'cyan');
    log('  node scripts/analyze-bundle.js\n', 'cyan');
    log('Options:', 'bright');
    log('  --help, -h    Show this help message', 'cyan');
    return;
  }

  analyzeBundleSize();
}

if (require.main === module) {
  main();
}

module.exports = { analyzeBundleSize };