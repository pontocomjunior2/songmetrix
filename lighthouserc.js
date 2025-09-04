module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: [
        'http://localhost:5173',
        'http://localhost:5173/dashboard',
        'http://localhost:5173/ranking',
        'http://localhost:5173/realtime'
      ],
      // Lighthouse settings
      settings: {
        chromeFlags: '--no-sandbox --headless --disable-gpu',
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        skipAudits: [
          'canonical',
          'robots-txt',
          'tap-targets',
          'content-width'
        ]
      },
      // Number of runs per URL
      numberOfRuns: 3,
      // Start server automatically
      startServerCommand: 'npm run dev',
      startServerReadyPattern: 'Local:.*:5173',
      startServerReadyTimeout: 30000
    },
    assert: {
      // Performance budgets
      assertions: {
        'categories:performance': ['error', { minScore: 0.7 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.8 }],
        'categories:seo': ['error', { minScore: 0.8 }],
        
        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        
        // Performance metrics
        'speed-index': ['error', { maxNumericValue: 4000 }],
        'interactive': ['error', { maxNumericValue: 5000 }],
        
        // Resource optimization
        'unused-javascript': ['warn', { maxNumericValue: 100000 }],
        'unused-css-rules': ['warn', { maxNumericValue: 50000 }],
        'render-blocking-resources': ['warn', { maxNumericValue: 500 }],
        
        // Best practices
        'uses-optimized-images': 'warn',
        'uses-webp-images': 'warn',
        'uses-responsive-images': 'warn',
        'efficient-animated-content': 'warn',
        
        // Accessibility
        'color-contrast': 'error',
        'image-alt': 'error',
        'label': 'error',
        'link-name': 'error'
      }
    },
    upload: {
      // Store results locally for now
      target: 'filesystem',
      outputDir: './lighthouse-results',
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%'
    },
    server: {
      // Optional: LHCI server configuration
      // target: 'lhci',
      // serverBaseUrl: 'http://localhost:9001'
    }
  }
};