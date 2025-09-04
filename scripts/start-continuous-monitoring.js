#!/usr/bin/env node

/**
 * Continuous Performance Monitoring Startup Script
 * Starts real-user monitoring for production environments
 */

const { continuousPerformanceMonitoring } = require('../src/services/continuousPerformanceMonitoring.ts');

async function startContinuousMonitoring() {
  console.log('🔄 Starting Continuous Performance Monitoring...\n');

  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    let configFile = null;
    let environment = 'development';
    let interval = 60000; // 1 minute default

    args.forEach((arg, index) => {
      if (arg === '--config' && args[index + 1]) {
        configFile = args[index + 1];
      }
      if (arg === '--env' && args[index + 1]) {
        environment = args[index + 1];
      }
      if (arg === '--interval' && args[index + 1]) {
        interval = parseInt(args[index + 1]) * 1000; // Convert to milliseconds
      }
    });

    // Load custom configuration if provided
    let customConfig = {};
    if (configFile) {
      try {
        const fs = require('fs');
        customConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        console.log(`📋 Loaded configuration from: ${configFile}`);
      } catch (error) {
        console.warn(`⚠️  Could not load config file: ${configFile}`);
        console.warn('Using default configuration');
      }
    }

    // Environment-specific configuration
    const environmentConfig = getEnvironmentConfig(environment);
    
    // Merge configurations
    const finalConfig = {
      ...environmentConfig,
      ...customConfig,
      interval
    };

    console.log('🎯 Monitoring Configuration:');
    console.log(`- Environment: ${environment}`);
    console.log(`- Monitoring Interval: ${finalConfig.interval / 1000} seconds`);
    console.log(`- Endpoints: ${finalConfig.endpoints.length}`);
    console.log(`- Alerting: ${finalConfig.alerting.enabled ? 'Enabled' : 'Disabled'}`);
    console.log('');

    // Display endpoints being monitored
    console.log('📡 Endpoints to Monitor:');
    finalConfig.endpoints.forEach((endpoint, index) => {
      const criticalIcon = endpoint.critical ? '🔴' : '🟡';
      console.log(`${index + 1}. ${criticalIcon} ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);
      console.log(`   Method: ${endpoint.method}`);
      console.log(`   Timeout: ${endpoint.timeout}ms`);
      console.log('');
    });

    // Display thresholds
    console.log('⚠️  Alert Thresholds:');
    console.log(`- Response Time Warning: ${finalConfig.thresholds.responseTime.warning}ms`);
    console.log(`- Response Time Critical: ${finalConfig.thresholds.responseTime.critical}ms`);
    console.log(`- Error Rate Warning: ${finalConfig.thresholds.errorRate.warning}%`);
    console.log(`- Error Rate Critical: ${finalConfig.thresholds.errorRate.critical}%`);
    console.log(`- Availability Warning: ${finalConfig.thresholds.availability.warning}%`);
    console.log(`- Availability Critical: ${finalConfig.thresholds.availability.critical}%`);
    console.log('');

    // Display alerting configuration
    if (finalConfig.alerting.enabled) {
      console.log('🚨 Alerting Configuration:');
      console.log(`- Cooldown Period: ${finalConfig.alerting.cooldown / 1000} seconds`);
      console.log('- Alert Channels:');
      finalConfig.alerting.channels.forEach(channel => {
        const enabledIcon = channel.enabled ? '✅' : '❌';
        console.log(`  ${enabledIcon} ${channel.type}`);
      });
      console.log('');
    }

    // Update monitoring configuration
    continuousPerformanceMonitoring.updateConfig(finalConfig);

    // Start monitoring
    continuousPerformanceMonitoring.start();

    // Display status
    console.log('✅ Continuous Performance Monitoring Started Successfully!\n');

    // Setup graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      continuousPerformanceMonitoring.stop();
      
      // Export final data
      const exportData = continuousPerformanceMonitoring.exportData();
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `monitoring-export-${timestamp}.json`;
      
      try {
        fs.writeFileSync(filename, exportData);
        console.log(`📁 Monitoring data exported to: ${filename}`);
      } catch (error) {
        console.error('Failed to export monitoring data:', error);
      }
      
      console.log('👋 Monitoring stopped. Goodbye!');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      continuousPerformanceMonitoring.stop();
      process.exit(0);
    });

    // Display real-time status updates
    setInterval(() => {
      const status = continuousPerformanceMonitoring.getStatus();
      const recentAlerts = continuousPerformanceMonitoring.getAlerts(false, Date.now() - 60000); // Last minute
      
      console.log(`📊 Status Update - ${new Date().toISOString()}`);
      console.log(`- Uptime: ${Math.floor(status.uptime / 1000)} seconds`);
      console.log(`- Metrics Collected: ${status.metricsCount}`);
      console.log(`- Active Alerts: ${recentAlerts.length}`);
      console.log(`- Total Reports: ${status.reportsCount}`);
      
      if (recentAlerts.length > 0) {
        console.log('- Recent Alerts:');
        recentAlerts.forEach(alert => {
          console.log(`  🚨 ${alert.level.toUpperCase()}: ${alert.message}`);
        });
      }
      console.log('---');
    }, 5 * 60 * 1000); // Every 5 minutes

    // Keep the process running
    console.log('🔄 Monitoring is running... Press Ctrl+C to stop.\n');

  } catch (error) {
    console.error('❌ Failed to start continuous monitoring:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function getEnvironmentConfig(environment) {
  const baseConfig = {
    enabled: true,
    interval: 60000, // 1 minute
    thresholds: {
      responseTime: {
        warning: 2000,
        critical: 5000
      },
      errorRate: {
        warning: 5,
        critical: 10
      },
      availability: {
        warning: 99,
        critical: 95
      },
      throughput: {
        warning: 10,
        critical: 5
      }
    },
    alerting: {
      enabled: true,
      cooldown: 5 * 60 * 1000, // 5 minutes
      channels: [
        {
          type: 'console',
          config: {},
          enabled: true
        }
      ],
      escalation: {
        enabled: false,
        levels: []
      }
    },
    retention: {
      metrics: 30,
      alerts: 90,
      reports: 365
    }
  };

  switch (environment) {
    case 'production':
      return {
        ...baseConfig,
        interval: 30000, // 30 seconds for production
        endpoints: [
          {
            name: 'Dashboard API',
            url: 'https://api.songmetrix.com/api/dashboard/batch',
            method: 'GET',
            timeout: 10000,
            critical: true
          },
          {
            name: 'User Preferences API',
            url: 'https://api.songmetrix.com/api/user/preferences',
            method: 'GET',
            timeout: 5000,
            critical: false
          },
          {
            name: 'Radio Status API',
            url: 'https://api.songmetrix.com/api/radio/status',
            method: 'GET',
            timeout: 5000,
            critical: false
          },
          {
            name: 'Frontend Health',
            url: 'https://songmetrix.com',
            method: 'GET',
            timeout: 10000,
            critical: true
          }
        ],
        thresholds: {
          responseTime: {
            warning: 1500,
            critical: 3000
          },
          errorRate: {
            warning: 2,
            critical: 5
          },
          availability: {
            warning: 99.5,
            critical: 99
          },
          throughput: {
            warning: 50,
            critical: 20
          }
        },
        alerting: {
          ...baseConfig.alerting,
          channels: [
            {
              type: 'console',
              config: {},
              enabled: true
            },
            {
              type: 'slack',
              config: {
                webhook: process.env.SLACK_WEBHOOK_URL
              },
              enabled: !!process.env.SLACK_WEBHOOK_URL
            },
            {
              type: 'email',
              config: {
                to: process.env.ALERT_EMAIL
              },
              enabled: !!process.env.ALERT_EMAIL
            }
          ]
        }
      };

    case 'staging':
      return {
        ...baseConfig,
        endpoints: [
          {
            name: 'Dashboard API',
            url: 'https://staging-api.songmetrix.com/api/dashboard/batch',
            method: 'GET',
            timeout: 10000,
            critical: true
          },
          {
            name: 'Frontend Health',
            url: 'https://staging.songmetrix.com',
            method: 'GET',
            timeout: 10000,
            critical: true
          }
        ],
        thresholds: {
          responseTime: {
            warning: 3000,
            critical: 8000
          },
          errorRate: {
            warning: 10,
            critical: 20
          },
          availability: {
            warning: 95,
            critical: 90
          },
          throughput: {
            warning: 5,
            critical: 2
          }
        }
      };

    case 'development':
    default:
      return {
        ...baseConfig,
        endpoints: [
          {
            name: 'Dashboard API',
            url: 'http://localhost:3001/api/dashboard/batch',
            method: 'GET',
            timeout: 10000,
            critical: true
          },
          {
            name: 'User Preferences API',
            url: 'http://localhost:3001/api/user/preferences',
            method: 'GET',
            timeout: 5000,
            critical: false
          },
          {
            name: 'Radio Status API',
            url: 'http://localhost:3001/api/radio/status',
            method: 'GET',
            timeout: 5000,
            critical: false
          },
          {
            name: 'Frontend Health',
            url: 'http://localhost:5173',
            method: 'GET',
            timeout: 10000,
            critical: true
          }
        ]
      };
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Continuous Performance Monitoring');
  console.log('');
  console.log('Usage:');
  console.log('  npm run perf:monitor -- --env production --interval 30');
  console.log('');
  console.log('Options:');
  console.log('  --env <environment>     Environment (development, staging, production)');
  console.log('  --config <file>         Custom configuration file (JSON)');
  console.log('  --interval <seconds>    Monitoring interval in seconds (default: 60)');
  console.log('  --help, -h              Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  # Start monitoring in development');
  console.log('  npm run perf:monitor');
  console.log('');
  console.log('  # Start monitoring in production with 30-second intervals');
  console.log('  npm run perf:monitor -- --env production --interval 30');
  console.log('');
  console.log('  # Start monitoring with custom configuration');
  console.log('  npm run perf:monitor -- --config monitoring-config.json');
  console.log('');
  console.log('Environment Variables:');
  console.log('  SLACK_WEBHOOK_URL       Slack webhook for alerts (production)');
  console.log('  ALERT_EMAIL            Email address for alerts (production)');
  console.log('');
  process.exit(0);
}

startContinuousMonitoring();