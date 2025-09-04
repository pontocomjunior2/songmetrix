import React, { useState, useEffect } from 'react';
import { performanceTestingService, PerformanceTestResult, PerformanceTestConfig } from '../../services/performanceTestingService';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export const PerformanceTesting: React.FC = () => {
  const [testResults, setTestResults] = useState<PerformanceTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testConfig, setTestConfig] = useState<Partial<PerformanceTestConfig>>({
    urls: ['http://localhost:5173', 'http://localhost:5173/dashboard'],
    numberOfRuns: 3,
    device: 'desktop',
    throttling: 'none'
  });
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    // Load existing test results
    const history = performanceTestingService.getTestHistory();
    setTestResults(history);
    
    if (history.length > 0) {
      const generatedReport = performanceTestingService.generatePerformanceReport();
      setReport(generatedReport);
    }
  }, []);

  const runTests = async () => {
    setIsRunning(true);
    try {
      const results = await performanceTestingService.runPerformanceTests(testConfig);
      setTestResults(performanceTestingService.getTestHistory());
      
      const generatedReport = performanceTestingService.generatePerformanceReport();
      setReport(generatedReport);
      
      console.log('Performance tests completed:', results);
    } catch (error) {
      console.error('Performance tests failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const clearHistory = () => {
    performanceTestingService.clearTestHistory();
    setTestResults([]);
    setReport(null);
  };

  const exportResults = () => {
    const data = performanceTestingService.exportResults();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-test-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 90) return 'default';
    if (score >= 70) return 'secondary';
    return 'destructive';
  };

  const formatMetric = (value: number, unit: string): string => {
    if (unit === 'ms') {
      return `${Math.round(value)}ms`;
    }
    if (unit === 'score') {
      return value.toFixed(3);
    }
    return Math.round(value).toString();
  };

  const prepareChartData = () => {
    return testResults.slice(-10).map((result, index) => ({
      test: index + 1,
      performance: result.scores.performance,
      accessibility: result.scores.accessibility,
      bestPractices: result.scores.bestPractices,
      seo: result.scores.seo,
      lcp: result.metrics.largestContentfulPaint,
      fcp: result.metrics.firstContentfulPaint,
      cls: result.metrics.cumulativeLayoutShift * 1000, // Scale for visibility
      timestamp: new Date(result.timestamp).toLocaleDateString()
    }));
  };

  const chartData = prepareChartData();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Performance Testing</h1>
          <p className="text-gray-600 mt-1">Automated performance testing and monitoring</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={runTests}
            disabled={isRunning}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRunning ? 'Running Tests...' : 'Run Tests'}
          </Button>
          <Button variant="outline" onClick={exportResults}>
            Export Results
          </Button>
          <Button variant="destructive" onClick={clearHistory}>
            Clear History
          </Button>
        </div>
      </div>

      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">URLs to Test</label>
              <textarea
                value={testConfig.urls?.join('\n') || ''}
                onChange={(e) => setTestConfig({
                  ...testConfig,
                  urls: e.target.value.split('\n').filter(url => url.trim())
                })}
                className="w-full border rounded px-3 py-2 text-sm"
                rows={3}
                placeholder="http://localhost:5173"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Number of Runs</label>
              <select
                value={testConfig.numberOfRuns || 3}
                onChange={(e) => setTestConfig({
                  ...testConfig,
                  numberOfRuns: Number(e.target.value)
                })}
                className="w-full border rounded px-3 py-2"
              >
                <option value={1}>1</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Device</label>
              <select
                value={testConfig.device || 'desktop'}
                onChange={(e) => setTestConfig({
                  ...testConfig,
                  device: e.target.value as 'desktop' | 'mobile'
                })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Throttling</label>
              <select
                value={testConfig.throttling || 'none'}
                onChange={(e) => setTestConfig({
                  ...testConfig,
                  throttling: e.target.value as 'none' | 'slow-4g' | 'fast-3g'
                })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="none">None</option>
                <option value="fast-3g">Fast 3G</option>
                <option value="slow-4g">Slow 4G</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results Summary */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {report.summary.passRate}%
              </div>
              <p className="text-xs text-gray-600">
                {report.summary.recentTests} recent tests
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(report.summary.averageScores.performance)}`}>
                {report.summary.averageScores.performance}
              </div>
              <p className="text-xs text-gray-600">
                Lighthouse score
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg LCP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(report.summary.averageMetrics.largestContentfulPaint)}ms
              </div>
              <p className="text-xs text-gray-600">
                Largest Contentful Paint
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {report.summary.totalTests}
              </div>
              <p className="text-xs text-gray-600">
                All time
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Trends */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Lighthouse Scores Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="test" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="performance" stroke="#3b82f6" name="Performance" />
                    <Line type="monotone" dataKey="accessibility" stroke="#10b981" name="Accessibility" />
                    <Line type="monotone" dataKey="bestPractices" stroke="#f59e0b" name="Best Practices" />
                    <Line type="monotone" dataKey="seo" stroke="#8b5cf6" name="SEO" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Core Web Vitals Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="test" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'cls') return [(value / 1000).toFixed(3), 'CLS'];
                        return [`${Math.round(value)}ms`, name.toUpperCase()];
                      }}
                    />
                    <Line type="monotone" dataKey="lcp" stroke="#ef4444" name="LCP" />
                    <Line type="monotone" dataKey="fcp" stroke="#f97316" name="FCP" />
                    <Line type="monotone" dataKey="cls" stroke="#84cc16" name="CLS (×1000)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget Violations */}
      {report && report.violations && report.violations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Common Budget Violations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.violations.slice(0, 5).map((violation: any, index: number) => (
                <Alert key={index} className="border-yellow-200 bg-yellow-50">
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{violation.metric.replace(/-/g, ' ').toUpperCase()}</p>
                        <p className="text-sm text-gray-600">
                          Violated in {violation.count} out of {report.summary.recentTests} recent tests
                        </p>
                        {violation.examples.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Latest: {formatMetric(violation.examples[0].actual, violation.examples[0].unit || 'ms')} 
                            (budget: {formatMetric(violation.examples[0].budget, violation.examples[0].unit || 'ms')})
                          </p>
                        )}
                      </div>
                      <Badge variant={violation.severity === 'error' ? 'destructive' : 'secondary'}>
                        {violation.severity}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {report && report.recommendations && report.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.recommendations.map((recommendation: string, index: number) => (
                <div key={index} className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <p className="text-sm">{recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">URL</th>
                    <th className="text-left p-2">Performance</th>
                    <th className="text-left p-2">Accessibility</th>
                    <th className="text-left p-2">Best Practices</th>
                    <th className="text-left p-2">SEO</th>
                    <th className="text-left p-2">LCP</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.slice(-10).reverse().map((result) => (
                    <tr key={result.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{result.url}</td>
                      <td className="p-2">
                        <Badge variant={getScoreBadgeVariant(result.scores.performance)}>
                          {Math.round(result.scores.performance)}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge variant={getScoreBadgeVariant(result.scores.accessibility)}>
                          {Math.round(result.scores.accessibility)}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge variant={getScoreBadgeVariant(result.scores.bestPractices)}>
                          {Math.round(result.scores.bestPractices)}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge variant={getScoreBadgeVariant(result.scores.seo)}>
                          {Math.round(result.scores.seo)}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs">
                        {Math.round(result.metrics.largestContentfulPaint)}ms
                      </td>
                      <td className="p-2">
                        <Badge variant={result.passed ? 'default' : 'destructive'}>
                          {result.passed ? 'Pass' : 'Fail'}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs">
                        {new Date(result.timestamp).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results Message */}
      {testResults.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 mb-4">No performance test results available</p>
            <Button onClick={runTests} disabled={isRunning}>
              {isRunning ? 'Running Tests...' : 'Run Your First Test'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};