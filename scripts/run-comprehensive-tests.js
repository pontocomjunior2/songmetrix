#!/usr/bin/env node

/**
 * Comprehensive Performance Testing Script
 * Runs all performance tests in a coordinated manner
 */

const { comprehensiveTestRunner } = require('../src/services/comprehensiveTestRunner.ts');

async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Performance Tests...\n');

  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    let suiteType = 'dashboard';
    let baselineId = null;
    let version = 'current';

    args.forEach((arg, index) => {
      if (arg === '--suite' && args[index + 1]) {
        suiteType = args[index + 1];
      }
      if (arg === '--baseline' && args[index + 1]) {
        baselineId = args[index + 1];
      }
      if (arg === '--version' && args[index + 1]) {
        version = args[index + 1];
      }
    });

    let testSuite;

    // Create appropriate test suite
    switch (suiteType) {
      case 'dashboard':
        console.log('Creating Dashboard Performance Test Suite...');
        testSuite = comprehensiveTestRunner.createDashboardPerformanceTestSuite();
        break;
        
      case 'regression':
        if (!baselineId) {
          console.log('❌ Baseline ID required for regression tests. Use --baseline <id>');
          process.exit(1);
        }
        console.log('Creating Performance Regression Test Suite...');
        testSuite = comprehensiveTestRunner.createRegressionTestSuite(baselineId, version);
        break;
        
      default:
        console.log(`❌ Unknown suite type: ${suiteType}`);
        console.log('Available suite types: dashboard, regression');
        process.exit(1);
    }

    console.log(`Test Suite: ${testSuite.name}`);
    console.log(`Description: ${testSuite.description}`);
    console.log(`Tests: ${testSuite.tests.length}\n`);

    // List tests to be run
    console.log('📋 Tests to be executed:');
    testSuite.tests.forEach((test, index) => {
      const status = test.enabled ? '✅' : '⏭️';
      const priority = test.priority === 'high' ? '🔴' : test.priority === 'medium' ? '🟡' : '🟢';
      console.log(`${index + 1}. ${status} ${priority} ${test.name} (${test.type})`);
    });
    console.log('');

    // Run the test suite
    console.log('🏃 Executing test suite...\n');
    const result = await comprehensiveTestRunner.runTestSuite(testSuite.id);

    // Report results
    console.log('📊 Comprehensive Test Results:');
    console.log(`- Overall Status: ${getStatusIcon(result.overallStatus)} ${result.overallStatus.toUpperCase()}`);
    console.log(`- Total Duration: ${(result.totalDuration / 1000).toFixed(2)} seconds`);
    console.log(`- Tests Run: ${result.summary.totalTests}`);
    console.log(`- Passed: ${result.summary.passedTests}`);
    console.log(`- Warnings: ${result.summary.warningTests}`);
    console.log(`- Failed: ${result.summary.failedTests}`);
    console.log(`- Skipped: ${result.summary.skippedTests}`);
    console.log(`- Pass Rate: ${result.summary.passRate}%`);
    console.log(`- Average Test Duration: ${(result.summary.averageDuration / 1000).toFixed(2)} seconds`);
    
    if (result.summary.performanceScore > 0) {
      console.log(`- Overall Performance Score: ${result.summary.performanceScore}/100`);
    }
    console.log('');

    // Detailed test results
    console.log('📋 Individual Test Results:');
    result.testResults.forEach((test, index) => {
      const statusIcon = getStatusIcon(test.status);
      const durationStr = (test.duration / 1000).toFixed(2);
      
      console.log(`${index + 1}. ${statusIcon} ${test.testName} (${test.testType})`);
      console.log(`   Duration: ${durationStr}s`);
      
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
      
      // Show key metrics for each test type
      if (test.result && test.status !== 'skipped') {
        switch (test.testType) {
          case 'lighthouse':
            if (Array.isArray(test.result)) {
              const avgScore = test.result.reduce((sum, r) => sum + r.scores.performance, 0) / test.result.length;
              console.log(`   Performance Score: ${avgScore.toFixed(2)}/100`);
            }
            break;
            
          case 'load':
            console.log(`   Requests/sec: ${test.result.requestsPerSecond.toFixed(2)}`);
            console.log(`   Error Rate: ${test.result.errorRate.toFixed(2)}%`);
            console.log(`   Avg Response: ${test.result.averageResponseTime.toFixed(2)}ms`);
            break;
            
          case 'journey':
            if (Array.isArray(test.result)) {
              const successRate = (test.result.filter(r => r.success).length / test.result.length) * 100;
              console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
            } else {
              console.log(`   Success: ${test.result.success ? 'Yes' : 'No'}`);
              console.log(`   Steps: ${test.result.stepResults.filter(s => s.success).length}/${test.result.stepResults.length}`);
            }
            break;
            
          case 'regression':
            console.log(`   Regressions: ${test.result.regressions.length}`);
            console.log(`   Improvements: ${test.result.improvements.length}`);
            console.log(`   Performance Change: ${test.result.summary.overallPerformanceChange > 0 ? '+' : ''}${test.result.summary.overallPerformanceChange.toFixed(2)}%`);
            break;
        }
      }
      console.log('');
    });

    // Critical issues
    if (result.summary.criticalIssues.length > 0) {
      console.log('🚨 Critical Issues:');
      result.summary.criticalIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
      console.log('');
    }

    // Recommendations
    console.log('💡 Recommendations:');
    result.recommendations.forEach((recommendation, index) => {
      console.log(`${index + 1}. ${recommendation}`);
    });
    console.log('');

    // Performance summary for dashboard tests
    if (suiteType === 'dashboard') {
      const lighthouseTest = result.testResults.find(t => t.testType === 'lighthouse');
      const loadTest = result.testResults.find(t => t.testType === 'load');
      const journeyTest = result.testResults.find(t => t.testType === 'journey');

      console.log('🎯 Performance Summary:');
      
      if (lighthouseTest && lighthouseTest.result) {
        const avgMetrics = lighthouseTest.result.reduce((acc, r) => {
          acc.fcp += r.metrics.firstContentfulPaint;
          acc.lcp += r.metrics.largestContentfulPaint;
          acc.cls += r.metrics.cumulativeLayoutShift;
          acc.tbt += r.metrics.totalBlockingTime;
          return acc;
        }, { fcp: 0, lcp: 0, cls: 0, tbt: 0 });
        
        const count = lighthouseTest.result.length;
        console.log(`- First Contentful Paint: ${(avgMetrics.fcp / count).toFixed(2)}ms`);
        console.log(`- Largest Contentful Paint: ${(avgMetrics.lcp / count).toFixed(2)}ms`);
        console.log(`- Cumulative Layout Shift: ${(avgMetrics.cls / count).toFixed(3)}`);
        console.log(`- Total Blocking Time: ${(avgMetrics.tbt / count).toFixed(2)}ms`);
      }
      
      if (loadTest && loadTest.result) {
        console.log(`- Load Test Throughput: ${loadTest.result.requestsPerSecond.toFixed(2)} req/sec`);
        console.log(`- Load Test Error Rate: ${loadTest.result.errorRate.toFixed(2)}%`);
      }
      
      if (journeyTest && journeyTest.result) {
        const journeyResults = Array.isArray(journeyTest.result) ? journeyTest.result : [journeyTest.result];
        const avgDuration = journeyResults.reduce((sum, r) => sum + r.totalDuration, 0) / journeyResults.length;
        console.log(`- Average Journey Duration: ${avgDuration.toFixed(2)}ms`);
      }
      console.log('');
    }

    // Exit with appropriate code
    if (result.overallStatus === 'fail') {
      console.log('❌ Comprehensive tests failed. Critical issues need to be addressed.');
      process.exit(1);
    } else if (result.overallStatus === 'warning') {
      console.log('⚠️  Comprehensive tests passed with warnings. Review and optimize as needed.');
      process.exit(0);
    } else {
      console.log('✅ All comprehensive tests passed successfully!');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Comprehensive tests failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'pass': return '✅';
    case 'warning': return '⚠️';
    case 'fail': return '❌';
    case 'skipped': return '⏭️';
    default: return '❓';
  }
}

// Show usage if no arguments provided
if (process.argv.length === 2) {
  console.log('Comprehensive Performance Testing');
  console.log('');
  console.log('Usage:');
  console.log('  npm run perf:comprehensive -- --suite dashboard');
  console.log('  npm run perf:comprehensive -- --suite regression --baseline <id> --version v1.1.0');
  console.log('');
  console.log('Options:');
  console.log('  --suite <type>       Test suite type (dashboard, regression)');
  console.log('  --baseline <id>      Baseline ID for regression tests');
  console.log('  --version <version>  Version identifier');
  console.log('');
  console.log('Examples:');
  console.log('  # Run dashboard performance tests');
  console.log('  npm run perf:comprehensive -- --suite dashboard');
  console.log('');
  console.log('  # Run regression tests');
  console.log('  npm run perf:comprehensive -- --suite regression --baseline baseline-123 --version v1.1.0');
  console.log('');
  process.exit(0);
}

runComprehensiveTests();