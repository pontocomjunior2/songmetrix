#!/usr/bin/env node

/**
 * User Journey Testing Script
 * Runs comprehensive user journey tests
 */

const { userJourneyTestingService } = require('../src/services/userJourneyTestingService.ts');

async function runJourneyTests() {
  console.log('🎯 Starting User Journey Tests...\n');

  try {
    // Create test journeys
    const dashboardJourney = userJourneyTestingService.createDashboardJourney();
    const interactionJourney = userJourneyTestingService.createUserInteractionJourney();

    const journeys = [dashboardJourney, interactionJourney];

    // Run all journeys
    console.log(`Running ${journeys.length} user journeys...\n`);
    const results = await userJourneyTestingService.runMultipleJourneys(journeys);

    // Report results
    let allPassed = true;
    
    results.forEach((result, index) => {
      const journey = journeys[index];
      console.log(`Journey: ${journey.name}`);
      console.log(`- Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`- Duration: ${result.totalDuration}ms (expected: ${journey.expectedDuration}ms)`);
      console.log(`- Steps Completed: ${result.stepResults.filter(s => s.success).length}/${result.stepResults.length}`);
      
      if (result.performanceMetrics.firstContentfulPaint > 0) {
        console.log(`- First Contentful Paint: ${result.performanceMetrics.firstContentfulPaint.toFixed(2)}ms`);
      }
      if (result.performanceMetrics.largestContentfulPaint > 0) {
        console.log(`- Largest Contentful Paint: ${result.performanceMetrics.largestContentfulPaint.toFixed(2)}ms`);
      }
      if (result.performanceMetrics.cumulativeLayoutShift > 0) {
        console.log(`- Cumulative Layout Shift: ${result.performanceMetrics.cumulativeLayoutShift.toFixed(3)}`);
      }

      if (result.errors.length > 0) {
        console.log(`- Errors: ${result.errors.length}`);
        result.errors.forEach(error => {
          console.log(`  • ${error.stepName}: ${error.error}`);
        });
        allPassed = false;
      }

      // Check performance thresholds
      const performanceIssues = [];
      if (result.totalDuration > journey.expectedDuration * 1.5) {
        performanceIssues.push(`Journey took too long: ${result.totalDuration}ms > ${journey.expectedDuration * 1.5}ms`);
      }
      if (result.performanceMetrics.largestContentfulPaint > 2500) {
        performanceIssues.push(`LCP too high: ${result.performanceMetrics.largestContentfulPaint}ms > 2500ms`);
      }
      if (result.performanceMetrics.cumulativeLayoutShift > 0.1) {
        performanceIssues.push(`CLS too high: ${result.performanceMetrics.cumulativeLayoutShift} > 0.1`);
      }

      if (performanceIssues.length > 0) {
        console.log(`- Performance Issues: ${performanceIssues.length}`);
        performanceIssues.forEach(issue => {
          console.log(`  • ${issue}`);
        });
        allPassed = false;
      }

      console.log('');
    });

    // Overall summary
    const passedJourneys = results.filter(r => r.success).length;
    const totalJourneys = results.length;
    
    console.log('📊 Journey Test Summary:');
    console.log(`- Total Journeys: ${totalJourneys}`);
    console.log(`- Passed: ${passedJourneys}`);
    console.log(`- Failed: ${totalJourneys - passedJourneys}`);
    console.log(`- Success Rate: ${((passedJourneys / totalJourneys) * 100).toFixed(2)}%`);

    if (allPassed) {
      console.log('\n✅ All user journey tests passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some user journey tests failed. Review the issues above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Journey tests failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const options = {
  headless: true,
  screenshots: false,
  timeout: 30000
};

args.forEach((arg, index) => {
  if (arg === '--headed') {
    options.headless = false;
  }
  if (arg === '--screenshots') {
    options.screenshots = true;
  }
  if (arg === '--timeout' && args[index + 1]) {
    options.timeout = parseInt(args[index + 1]);
  }
});

console.log('Journey Test Configuration:');
console.log(`- Headless Mode: ${options.headless}`);
console.log(`- Screenshots: ${options.screenshots}`);
console.log(`- Timeout: ${options.timeout}ms\n`);

runJourneyTests();