#!/usr/bin/env node

/**
 * Performance Baseline Creation Script
 * Creates performance baselines for regression testing
 */

const { performanceRegressionService } = require('../src/services/performanceRegressionService.ts');

async function createPerformanceBaseline() {
  console.log('📊 Creating Performance Baseline...\n');

  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    let name = `Baseline ${new Date().toISOString().split('T')[0]}`;
    let version = 'current';
    let description = '';

    args.forEach((arg, index) => {
      if (arg === '--name' && args[index + 1]) {
        name = args[index + 1];
      }
      if (arg === '--version' && args[index + 1]) {
        version = args[index + 1];
      }
      if (arg === '--description' && args[index + 1]) {
        description = args[index + 1];
      }
    });

    console.log('Baseline Configuration:');
    console.log(`- Name: ${name}`);
    console.log(`- Version: ${version}`);
    if (description) {
      console.log(`- Description: ${description}`);
    }
    console.log('');

    console.log('🔄 Collecting performance metrics...');
    console.log('This may take several minutes as we run comprehensive tests.\n');

    // Create the baseline
    const baseline = await performanceRegressionService.createBaseline(name, version);

    console.log('✅ Performance baseline created successfully!\n');

    // Display baseline details
    console.log('📋 Baseline Details:');
    console.log(`- Baseline ID: ${baseline.id}`);
    console.log(`- Name: ${baseline.name}`);
    console.log(`- Version: ${baseline.version}`);
    console.log(`- Created: ${new Date(baseline.timestamp).toLocaleString()}`);
    console.log('');

    console.log('🎯 Performance Metrics:');
    console.log('');

    // Lighthouse Scores
    console.log('Lighthouse Scores:');
    console.log(`- Performance: ${baseline.metrics.performanceScore.toFixed(2)}/100`);
    console.log(`- Accessibility: ${baseline.metrics.accessibilityScore.toFixed(2)}/100`);
    console.log(`- Best Practices: ${baseline.metrics.bestPracticesScore.toFixed(2)}/100`);
    console.log(`- SEO: ${baseline.metrics.seoScore.toFixed(2)}/100`);
    console.log('');

    // Core Web Vitals
    console.log('Core Web Vitals:');
    console.log(`- First Contentful Paint: ${baseline.metrics.firstContentfulPaint.toFixed(2)}ms`);
    console.log(`- Largest Contentful Paint: ${baseline.metrics.largestContentfulPaint.toFixed(2)}ms`);
    console.log(`- Cumulative Layout Shift: ${baseline.metrics.cumulativeLayoutShift.toFixed(3)}`);
    console.log(`- First Input Delay: ${baseline.metrics.firstInputDelay.toFixed(2)}ms`);
    console.log(`- Total Blocking Time: ${baseline.metrics.totalBlockingTime.toFixed(2)}ms`);
    console.log(`- Time to Interactive: ${baseline.metrics.timeToInteractive.toFixed(2)}ms`);
    console.log('');

    // Custom Metrics
    console.log('Custom Metrics:');
    console.log(`- Dashboard Load Time: ${baseline.metrics.dashboardLoadTime.toFixed(2)}ms`);
    console.log(`- API Response Time: ${baseline.metrics.apiResponseTime.toFixed(2)}ms`);
    console.log(`- Bundle Size: ${(baseline.metrics.bundleSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`- Memory Usage: ${(baseline.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log('');

    // Load Test Metrics
    console.log('Load Test Metrics:');
    console.log(`- Throughput: ${baseline.metrics.throughput.toFixed(2)} requests/sec`);
    console.log(`- Error Rate: ${baseline.metrics.errorRate.toFixed(2)}%`);
    console.log(`- P95 Response Time: ${baseline.metrics.p95ResponseTime.toFixed(2)}ms`);
    console.log('');

    // Environment Info
    console.log('Test Environment:');
    console.log(`- Browser: ${baseline.environment.browser} ${baseline.environment.browserVersion}`);
    console.log(`- Device: ${baseline.environment.device}`);
    console.log(`- Network: ${baseline.environment.networkCondition}`);
    console.log(`- CPU Throttling: ${baseline.environment.cpuThrottling}x`);
    console.log(`- Memory Limit: ${baseline.environment.memoryLimit}MB`);
    console.log('');

    // Test Configuration
    console.log('Test Configuration:');
    console.log(`- URLs Tested: ${baseline.testConfig.urls.length}`);
    baseline.testConfig.urls.forEach(url => {
      console.log(`  • ${url}`);
    });
    console.log(`- Test Duration: ${baseline.testConfig.testDuration} seconds`);
    console.log(`- Concurrent Users: ${baseline.testConfig.concurrentUsers}`);
    console.log(`- Iterations: ${baseline.testConfig.iterations}`);
    console.log('');

    // Performance Assessment
    console.log('📈 Performance Assessment:');
    const assessments = [];

    if (baseline.metrics.performanceScore >= 90) {
      assessments.push('✅ Excellent overall performance score');
    } else if (baseline.metrics.performanceScore >= 70) {
      assessments.push('⚠️  Good performance score, room for improvement');
    } else {
      assessments.push('❌ Poor performance score, optimization needed');
    }

    if (baseline.metrics.largestContentfulPaint <= 2500) {
      assessments.push('✅ Good Largest Contentful Paint');
    } else {
      assessments.push('⚠️  Slow Largest Contentful Paint');
    }

    if (baseline.metrics.cumulativeLayoutShift <= 0.1) {
      assessments.push('✅ Good Cumulative Layout Shift');
    } else {
      assessments.push('⚠️  High Cumulative Layout Shift');
    }

    if (baseline.metrics.totalBlockingTime <= 300) {
      assessments.push('✅ Good Total Blocking Time');
    } else {
      assessments.push('⚠️  High Total Blocking Time');
    }

    if (baseline.metrics.errorRate <= 1) {
      assessments.push('✅ Low error rate under load');
    } else {
      assessments.push('⚠️  High error rate under load');
    }

    assessments.forEach(assessment => {
      console.log(`${assessment}`);
    });
    console.log('');

    // Usage Instructions
    console.log('🚀 Next Steps:');
    console.log('');
    console.log('1. Save this baseline ID for future regression tests:');
    console.log(`   ${baseline.id}`);
    console.log('');
    console.log('2. Run regression tests against this baseline:');
    console.log(`   npm run perf:regression-test -- --baseline ${baseline.id} --version v1.1.0`);
    console.log('');
    console.log('3. Run comprehensive regression testing:');
    console.log(`   npm run perf:comprehensive -- --suite regression --baseline ${baseline.id} --version v1.1.0`);
    console.log('');
    console.log('4. Set up automated regression testing in CI/CD:');
    console.log('   Add the baseline ID to your CI/CD environment variables');
    console.log('   and run regression tests on every deployment.');
    console.log('');

    // Export baseline data
    const exportData = performanceRegressionService.exportData();
    console.log('💾 Baseline data has been saved locally and can be exported if needed.');
    console.log('');

    console.log('✅ Baseline creation completed successfully!');

  } catch (error) {
    console.error('❌ Failed to create performance baseline:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Performance Baseline Creation');
  console.log('');
  console.log('Usage:');
  console.log('  npm run perf:baseline -- --name "Release v1.0" --version v1.0.0');
  console.log('');
  console.log('Options:');
  console.log('  --name <name>           Baseline name (default: "Baseline YYYY-MM-DD")');
  console.log('  --version <version>     Version identifier (default: "current")');
  console.log('  --description <desc>    Optional description');
  console.log('  --help, -h              Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  # Create baseline with default name');
  console.log('  npm run perf:baseline');
  console.log('');
  console.log('  # Create baseline for specific release');
  console.log('  npm run perf:baseline -- --name "Release v1.0" --version v1.0.0');
  console.log('');
  console.log('  # Create baseline with description');
  console.log('  npm run perf:baseline -- --name "Pre-optimization" --version v0.9.0 --description "Before performance optimizations"');
  console.log('');
  process.exit(0);
}

createPerformanceBaseline();