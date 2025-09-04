#!/usr/bin/env node

/**
 * Load Testing Script
 * Runs comprehensive load tests for the dashboard
 */

const { loadTestingService } = require('../src/services/loadTestingService.ts');

async function runLoadTests() {
  console.log('🚀 Starting Load Tests...\n');

  try {
    // Dashboard Load Test
    console.log('Running Dashboard Load Test...');
    const dashboardConfig = loadTestingService.createDashboardLoadTest();
    const dashboardResult = await loadTestingService.runLoadTest(dashboardConfig);
    
    console.log('Dashboard Load Test Results:');
    console.log(`- Total Requests: ${dashboardResult.totalRequests}`);
    console.log(`- Success Rate: ${((dashboardResult.successfulRequests / dashboardResult.totalRequests) * 100).toFixed(2)}%`);
    console.log(`- Average Response Time: ${dashboardResult.averageResponseTime.toFixed(2)}ms`);
    console.log(`- Requests/Second: ${dashboardResult.requestsPerSecond.toFixed(2)}`);
    console.log(`- P95 Response Time: ${dashboardResult.p95ResponseTime.toFixed(2)}ms`);
    console.log(`- Error Rate: ${dashboardResult.errorRate.toFixed(2)}%\n`);

    // API Stress Test
    console.log('Running API Stress Test...');
    const apiConfig = loadTestingService.createApiStressTest();
    const apiResult = await loadTestingService.runLoadTest(apiConfig);
    
    console.log('API Stress Test Results:');
    console.log(`- Total Requests: ${apiResult.totalRequests}`);
    console.log(`- Success Rate: ${((apiResult.successfulRequests / apiResult.totalRequests) * 100).toFixed(2)}%`);
    console.log(`- Average Response Time: ${apiResult.averageResponseTime.toFixed(2)}ms`);
    console.log(`- Requests/Second: ${apiResult.requestsPerSecond.toFixed(2)}`);
    console.log(`- P95 Response Time: ${apiResult.p95ResponseTime.toFixed(2)}ms`);
    console.log(`- Error Rate: ${apiResult.errorRate.toFixed(2)}%\n`);

    // Determine overall status
    const dashboardPassed = dashboardResult.errorRate < 5 && dashboardResult.averageResponseTime < 2000;
    const apiPassed = apiResult.errorRate < 5 && apiResult.averageResponseTime < 1000;

    if (dashboardPassed && apiPassed) {
      console.log('✅ All load tests passed!');
      process.exit(0);
    } else {
      console.log('❌ Some load tests failed:');
      if (!dashboardPassed) {
        console.log('- Dashboard load test failed performance thresholds');
      }
      if (!apiPassed) {
        console.log('- API stress test failed performance thresholds');
      }
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Load tests failed:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const options = {
  users: 50,
  duration: 300,
  rampUp: 60
};

args.forEach((arg, index) => {
  if (arg === '--users' && args[index + 1]) {
    options.users = parseInt(args[index + 1]);
  }
  if (arg === '--duration' && args[index + 1]) {
    options.duration = parseInt(args[index + 1]);
  }
  if (arg === '--ramp-up' && args[index + 1]) {
    options.rampUp = parseInt(args[index + 1]);
  }
});

console.log('Load Test Configuration:');
console.log(`- Concurrent Users: ${options.users}`);
console.log(`- Duration: ${options.duration} seconds`);
console.log(`- Ramp Up Time: ${options.rampUp} seconds\n`);

runLoadTests();