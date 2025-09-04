#!/usr/bin/env node

/**
 * Performance Validation Script
 * Validates performance improvements against targets
 */

const { performanceValidationService } = require('../src/services/performanceValidationService.ts');

async function runPerformanceValidation() {
  console.log('🎯 Starting Performance Validation...\n');

  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    let version = 'current';
    let baselineFile = null;
    let customTargetsFile = null;

    args.forEach((arg, index) => {
      if (arg === '--version' && args[index + 1]) {
        version = args[index + 1];
      }
      if (arg === '--baseline' && args[index + 1]) {
        baselineFile = args[index + 1];
      }
      if (arg === '--targets' && args[index + 1]) {
        customTargetsFile = args[index + 1];
      }
    });

    // Load baseline data if provided
    let baselineData = null;
    if (baselineFile) {
      try {
        const fs = require('fs');
        baselineData = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
        console.log(`📊 Using baseline data from: ${baselineFile}`);
      } catch (error) {
        console.warn(`⚠️  Could not load baseline file: ${baselineFile}`);
      }
    }

    // Load custom targets if provided
    let customTargets = null;
    if (customTargetsFile) {
      try {
        const fs = require('fs');
        customTargets = JSON.parse(fs.readFileSync(customTargetsFile, 'utf8'));
        console.log(`🎯 Using custom targets from: ${customTargetsFile}`);
      } catch (error) {
        console.warn(`⚠️  Could not load targets file: ${customTargetsFile}`);
      }
    }

    console.log(`Validating performance for version: ${version}\n`);

    // Show default targets
    const defaultTargets = performanceValidationService.getDefaultTargets();
    console.log('📋 Performance Targets:');
    console.log('');
    
    console.log('Dashboard Load Times:');
    console.log(`- Cold Load: ≤ ${defaultTargets.dashboardLoadTime.cold}ms`);
    console.log(`- Warm Load: ≤ ${defaultTargets.dashboardLoadTime.warm}ms`);
    console.log('');
    
    console.log('Core Web Vitals:');
    console.log(`- First Contentful Paint: ≤ ${defaultTargets.coreWebVitals.firstContentfulPaint}ms`);
    console.log(`- Largest Contentful Paint: ≤ ${defaultTargets.coreWebVitals.largestContentfulPaint}ms`);
    console.log(`- Cumulative Layout Shift: ≤ ${defaultTargets.coreWebVitals.cumulativeLayoutShift}`);
    console.log(`- Total Blocking Time: ≤ ${defaultTargets.coreWebVitals.totalBlockingTime}ms`);
    console.log(`- Time to Interactive: ≤ ${defaultTargets.coreWebVitals.timeToInteractive}ms`);
    console.log('');
    
    console.log('API Performance:');
    console.log(`- Dashboard Batch API: ≤ ${defaultTargets.apiPerformance.dashboardBatch}ms`);
    console.log(`- User Preferences API: ≤ ${defaultTargets.apiPerformance.userPreferences}ms`);
    console.log(`- Radio Status API: ≤ ${defaultTargets.apiPerformance.radioStatus}ms`);
    console.log(`- Average Response Time: ≤ ${defaultTargets.apiPerformance.averageResponseTime}ms`);
    console.log('');

    // Run validation
    console.log('🔄 Running performance validation...');
    console.log('This may take several minutes as we collect comprehensive metrics.\n');

    const result = await performanceValidationService.validatePerformanceImprovements(
      version,
      baselineData,
      customTargets
    );

    // Display results
    console.log('📊 Performance Validation Results:');
    console.log(`- Overall Status: ${getStatusIcon(result.overallStatus)} ${result.overallStatus.toUpperCase()}`);
    console.log(`- Version: ${result.version}`);
    console.log(`- Targets Met: ${result.targetsMet}/${result.totalTargets} (${result.improvementPercentage.toFixed(2)}%)`);
    console.log(`- Average Improvement: ${result.summary.averageImprovement.toFixed(2)}%`);
    console.log('');

    // Summary by status
    console.log('📈 Summary by Status:');
    console.log(`- ✅ Passed: ${result.summary.passedTargets}`);
    console.log(`- ⚠️  Warnings: ${result.summary.warningTargets}`);
    console.log(`- ❌ Failed: ${result.summary.failedTargets}`);
    console.log('');

    // Detailed results by category
    const categories = [...new Set(result.validations.map(v => v.category))];
    
    categories.forEach(category => {
      const categoryValidations = result.validations.filter(v => v.category === category);
      const passed = categoryValidations.filter(v => v.status === 'pass').length;
      const total = categoryValidations.length;
      
      console.log(`📋 ${category} (${passed}/${total} passed):`);
      
      categoryValidations.forEach(validation => {
        const statusIcon = getStatusIcon(validation.status);
        const improvementStr = validation.improvement !== 0 ? 
          ` (${validation.improvement > 0 ? '+' : ''}${validation.improvement.toFixed(2)}% vs baseline)` : '';
        
        console.log(`${statusIcon} ${validation.metric}:`);
        console.log(`   Target: ${validation.target}${validation.unit}`);
        console.log(`   Actual: ${validation.actual.toFixed(2)}${validation.unit}${improvementStr}`);
        
        if (validation.status !== 'pass') {
          const diff = validation.actual - validation.target;
          const diffStr = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
          console.log(`   Difference: ${diffStr}${validation.unit}`);
        }
        console.log('');
      });
    });

    // Critical failures
    if (result.summary.criticalFailures.length > 0) {
      console.log('🚨 Critical Failures:');
      result.summary.criticalFailures.forEach((failure, index) => {
        console.log(`${index + 1}. ${failure}`);
      });
      console.log('');
    }

    // Significant improvements
    if (result.summary.significantImprovements.length > 0) {
      console.log('✨ Significant Improvements:');
      result.summary.significantImprovements.forEach((improvement, index) => {
        console.log(`${index + 1}. ${improvement}`);
      });
      console.log('');
    }

    // Network conditions results
    const networkValidations = result.validations.filter(v => v.category === 'Network Conditions');
    if (networkValidations.length > 0) {
      console.log('🌐 Network Conditions Performance:');
      networkValidations.forEach(validation => {
        const statusIcon = getStatusIcon(validation.status);
        console.log(`${statusIcon} ${validation.metric}: ${validation.actual.toFixed(2)}ms (target: ${validation.target.toFixed(2)}ms)`);
      });
      console.log('');
    }

    // Recommendations
    console.log('💡 Recommendations:');
    result.recommendations.forEach((recommendation, index) => {
      console.log(`${index + 1}. ${recommendation}`);
    });
    console.log('');

    // Performance score breakdown
    const coreWebVitalsValidations = result.validations.filter(v => v.category === 'Core Web Vitals');
    if (coreWebVitalsValidations.length > 0) {
      console.log('🎯 Core Web Vitals Assessment:');
      
      const fcpValidation = coreWebVitalsValidations.find(v => v.metric === 'First Contentful Paint');
      const lcpValidation = coreWebVitalsValidations.find(v => v.metric === 'Largest Contentful Paint');
      const clsValidation = coreWebVitalsValidations.find(v => v.metric === 'Cumulative Layout Shift');
      
      if (fcpValidation) {
        const fcpScore = fcpValidation.actual <= 1800 ? 'Good' : fcpValidation.actual <= 3000 ? 'Needs Improvement' : 'Poor';
        console.log(`- FCP: ${fcpValidation.actual.toFixed(2)}ms (${fcpScore})`);
      }
      
      if (lcpValidation) {
        const lcpScore = lcpValidation.actual <= 2500 ? 'Good' : lcpValidation.actual <= 4000 ? 'Needs Improvement' : 'Poor';
        console.log(`- LCP: ${lcpValidation.actual.toFixed(2)}ms (${lcpScore})`);
      }
      
      if (clsValidation) {
        const clsScore = clsValidation.actual <= 0.1 ? 'Good' : clsValidation.actual <= 0.25 ? 'Needs Improvement' : 'Poor';
        console.log(`- CLS: ${clsValidation.actual.toFixed(3)} (${clsScore})`);
      }
      console.log('');
    }

    // Export results
    const exportData = performanceValidationService.exportResults();
    console.log('💾 Validation results have been saved and can be exported if needed.');
    console.log('');

    // Final status and exit
    if (result.overallStatus === 'pass') {
      console.log('✅ Performance validation passed! All targets met.');
      process.exit(0);
    } else if (result.overallStatus === 'warning') {
      console.log('⚠️  Performance validation passed with warnings. Review and optimize as needed.');
      process.exit(0);
    } else {
      console.log('❌ Performance validation failed. Critical performance targets not met.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Performance validation failed:', error.message);
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

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Performance Validation');
  console.log('');
  console.log('Usage:');
  console.log('  npm run perf:validate -- --version v1.1.0 --baseline baseline.json');
  console.log('');
  console.log('Options:');
  console.log('  --version <version>     Version identifier (default: "current")');
  console.log('  --baseline <file>       JSON file with baseline performance data');
  console.log('  --targets <file>        JSON file with custom performance targets');
  console.log('  --help, -h              Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  # Basic validation');
  console.log('  npm run perf:validate');
  console.log('');
  console.log('  # Validation with baseline comparison');
  console.log('  npm run perf:validate -- --version v1.1.0 --baseline baseline-v1.0.json');
  console.log('');
  console.log('  # Validation with custom targets');
  console.log('  npm run perf:validate -- --targets custom-targets.json');
  console.log('');
  process.exit(0);
}

runPerformanceValidation();