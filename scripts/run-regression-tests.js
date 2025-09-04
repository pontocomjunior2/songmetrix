#!/usr/bin/env node

/**
 * Performance Regression Testing Script
 * Runs regression tests against performance baselines
 */

const { performanceRegressionService } = require('../src/services/performanceRegressionService.ts');

async function runRegressionTests() {
  console.log('📈 Starting Performance Regression Tests...\n');

  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    let baselineId = null;
    let version = 'current';
    let createBaseline = false;

    args.forEach((arg, index) => {
      if (arg === '--baseline' && args[index + 1]) {
        baselineId = args[index + 1];
      }
      if (arg === '--version' && args[index + 1]) {
        version = args[index + 1];
      }
      if (arg === '--create-baseline') {
        createBaseline = true;
      }
    });

    // Create baseline if requested
    if (createBaseline) {
      console.log('Creating new performance baseline...');
      const baseline = await performanceRegressionService.createBaseline(
        `Baseline ${new Date().toISOString().split('T')[0]}`,
        version
      );
      
      console.log(`✅ Baseline created: ${baseline.id}`);
      console.log(`- Performance Score: ${baseline.metrics.performanceScore.toFixed(2)}`);
      console.log(`- Dashboard Load Time: ${baseline.metrics.dashboardLoadTime.toFixed(2)}ms`);
      console.log(`- Bundle Size: ${(baseline.metrics.bundleSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Memory Usage: ${(baseline.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`\nUse this baseline ID for future regression tests: ${baseline.id}`);
      return;
    }

    // Find baseline to use
    if (!baselineId) {
      const latestBaseline = performanceRegressionService.getLatestBaseline();
      if (!latestBaseline) {
        console.log('❌ No baseline found. Create a baseline first with --create-baseline');
        process.exit(1);
      }
      baselineId = latestBaseline.id;
      console.log(`Using latest baseline: ${baselineId} (${latestBaseline.name})`);
    }

    // Run regression test
    console.log(`Running regression test against baseline: ${baselineId}...\n`);
    const result = await performanceRegressionService.runRegressionTest(baselineId, version);

    // Report results
    console.log('📊 Regression Test Results:');
    console.log(`- Overall Status: ${getStatusIcon(result.overallStatus)} ${result.overallStatus.toUpperCase()}`);
    console.log(`- Test Version: ${result.version}`);
    console.log(`- Total Regressions: ${result.regressions.length}`);
    console.log(`- Total Improvements: ${result.improvements.length}`);
    console.log(`- Overall Performance Change: ${result.summary.overallPerformanceChange > 0 ? '+' : ''}${result.summary.overallPerformanceChange.toFixed(2)}%\n`);

    // Report regressions
    if (result.regressions.length > 0) {
      console.log('⚠️  Performance Regressions:');
      result.regressions.forEach(regression => {
        const icon = regression.severity === 'critical' ? '🔴' : '🟡';
        console.log(`${icon} ${regression.metric}:`);
        console.log(`   Baseline: ${regression.baseline.toFixed(2)}`);
        console.log(`   Current: ${regression.current.toFixed(2)}`);
        console.log(`   Change: +${regression.change.toFixed(2)}% (threshold: ${regression.threshold}%)`);
        console.log(`   Impact: ${regression.impact}`);
        console.log('');
      });
    }

    // Report improvements
    if (result.improvements.length > 0) {
      console.log('✨ Performance Improvements:');
      result.improvements.forEach(improvement => {
        console.log(`🟢 ${improvement.metric}:`);
        console.log(`   Baseline: ${improvement.baseline.toFixed(2)}`);
        console.log(`   Current: ${improvement.current.toFixed(2)}`);
        console.log(`   Improvement: ${improvement.improvement.toFixed(2)}%`);
        console.log(`   Impact: ${improvement.impact}`);
        console.log('');
      });
    }

    // Detailed metrics comparison
    console.log('📋 Detailed Metrics Comparison:');
    const metrics = [
      { name: 'Performance Score', baseline: result.baselineMetrics.performanceScore, current: result.currentMetrics.performanceScore, unit: '' },
      { name: 'First Contentful Paint', baseline: result.baselineMetrics.firstContentfulPaint, current: result.currentMetrics.firstContentfulPaint, unit: 'ms' },
      { name: 'Largest Contentful Paint', baseline: result.baselineMetrics.largestContentfulPaint, current: result.currentMetrics.largestContentfulPaint, unit: 'ms' },
      { name: 'Cumulative Layout Shift', baseline: result.baselineMetrics.cumulativeLayoutShift, current: result.currentMetrics.cumulativeLayoutShift, unit: '' },
      { name: 'Total Blocking Time', baseline: result.baselineMetrics.totalBlockingTime, current: result.currentMetrics.totalBlockingTime, unit: 'ms' },
      { name: 'Dashboard Load Time', baseline: result.baselineMetrics.dashboardLoadTime, current: result.currentMetrics.dashboardLoadTime, unit: 'ms' },
      { name: 'Bundle Size', baseline: result.baselineMetrics.bundleSize / 1024 / 1024, current: result.currentMetrics.bundleSize / 1024 / 1024, unit: 'MB' },
      { name: 'Memory Usage', baseline: result.baselineMetrics.memoryUsage / 1024 / 1024, current: result.currentMetrics.memoryUsage / 1024 / 1024, unit: 'MB' }
    ];

    metrics.forEach(metric => {
      const change = ((metric.current - metric.baseline) / metric.baseline) * 100;
      const changeStr = change > 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
      const changeIcon = change > 0 ? (change > 10 ? '📈' : '↗️') : (change < -10 ? '📉' : '↘️');
      
      console.log(`${changeIcon} ${metric.name}:`);
      console.log(`   Baseline: ${metric.baseline.toFixed(2)}${metric.unit}`);
      console.log(`   Current: ${metric.current.toFixed(2)}${metric.unit}`);
      console.log(`   Change: ${changeStr}`);
      console.log('');
    });

    // Summary and recommendations
    console.log('💡 Recommendations:');
    console.log(`${result.summary.recommendation}\n`);

    // Exit with appropriate code
    if (result.overallStatus === 'fail') {
      console.log('❌ Regression test failed due to critical performance regressions.');
      process.exit(1);
    } else if (result.overallStatus === 'warning') {
      console.log('⚠️  Regression test passed with warnings. Monitor performance closely.');
      process.exit(0);
    } else {
      console.log('✅ Regression test passed. No significant performance regressions detected.');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Regression tests failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'pass': return '✅';
    case 'warning': return '⚠️';
    case 'fail': return '❌';
    default: return '❓';
  }
}

// Show usage if no arguments provided
if (process.argv.length === 2) {
  console.log('Performance Regression Testing');
  console.log('');
  console.log('Usage:');
  console.log('  npm run perf:regression-test -- --create-baseline --version v1.0.0');
  console.log('  npm run perf:regression-test -- --baseline <baseline-id> --version v1.1.0');
  console.log('');
  console.log('Options:');
  console.log('  --create-baseline    Create a new performance baseline');
  console.log('  --baseline <id>      Use specific baseline ID for comparison');
  console.log('  --version <version>  Version identifier for the test');
  console.log('');
  console.log('Examples:');
  console.log('  # Create baseline');
  console.log('  npm run perf:regression-test -- --create-baseline --version v1.0.0');
  console.log('');
  console.log('  # Run regression test');
  console.log('  npm run perf:regression-test -- --version v1.1.0');
  console.log('');
  process.exit(0);
}

runRegressionTests();