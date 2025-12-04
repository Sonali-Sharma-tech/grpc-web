import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Button,
  Alert,
} from '@mui/material';
import {
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { TaskServiceClient } from '../services/grpcClient';

interface MetricsPanelProps {
  metrics: {
    totalRequests: number;
    errors: number;
    averageLatency: number;
    activeStreams: number;
  };
  client: TaskServiceClient | null;
}

/**
 * Metrics Panel Component
 *
 * Displays performance metrics and demonstrates:
 * - RPC latency tracking
 * - Error rate monitoring
 * - Stream count tracking
 * - Method-specific metrics
 */
const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics, client }) => {
  const [detailedMetrics, setDetailedMetrics] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (client) {
      updateDetailedMetrics();
    }
  }, [client, metrics.totalRequests]); // Update when requests change

  const updateDetailedMetrics = () => {
    if (!client) return;

    setRefreshing(true);
    setTimeout(() => {
      const clientMetrics = client.getMetrics();
      setDetailedMetrics(clientMetrics);
      setRefreshing(false);
    }, 500);
  };

  const calculateErrorRate = () => {
    if (metrics.totalRequests === 0) return 0;
    return ((metrics.errors / metrics.totalRequests) * 100).toFixed(2);
  };

  const getMethodFromMetricKey = (key: string) => {
    return key.replace('_avg_ms', '').replace('_count', '');
  };

  const isLatencyMetric = (key: string) => key.endsWith('_avg_ms');
  const isCountMetric = (key: string) => key.endsWith('_count');

  // Group metrics by method
  const methodMetrics: Record<string, { count: number; avgLatency: number }> = {};
  Object.entries(detailedMetrics).forEach(([key, value]) => {
    if (key === 'activeStreams') return;

    const method = getMethodFromMetricKey(key);
    if (!methodMetrics[method]) {
      methodMetrics[method] = { count: 0, avgLatency: 0 };
    }

    if (isCountMetric(key)) {
      methodMetrics[method].count = value;
    } else if (isLatencyMetric(key)) {
      methodMetrics[method].avgLatency = value;
    }
  });

  return (
    <Grid container spacing={3}>
      {/* Overview Cards */}
      <Grid item xs={12}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TimelineIcon color="primary" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="subtitle2">
                    Total Requests
                  </Typography>
                </Box>
                <Typography variant="h4">{metrics.totalRequests}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ErrorIcon color="error" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="subtitle2">
                    Error Rate
                  </Typography>
                </Box>
                <Typography variant="h4">{calculateErrorRate()}%</Typography>
                <Typography variant="body2" color="text.secondary">
                  {metrics.errors} errors
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <SpeedIcon color="warning" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="subtitle2">
                    Avg Latency
                  </Typography>
                </Box>
                <Typography variant="h4">
                  {metrics.averageLatency.toFixed(0)}ms
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <SuccessIcon color="success" sx={{ mr: 1 }} />
                  <Typography color="text.secondary" variant="subtitle2">
                    Active Streams
                  </Typography>
                </Box>
                <Typography variant="h4">{metrics.activeStreams}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Grid>

      {/* Detailed Metrics Table */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Method Performance</Typography>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={updateDetailedMetrics}
                disabled={refreshing}
              >
                Refresh
              </Button>
            </Box>

            {refreshing && <LinearProgress sx={{ mb: 2 }} />}

            {Object.keys(methodMetrics).length === 0 ? (
              <Alert severity="info">
                No method metrics available yet. Make some API calls to see performance data.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Method</TableCell>
                      <TableCell align="right">Call Count</TableCell>
                      <TableCell align="right">Avg Latency</TableCell>
                      <TableCell align="right">Total Time</TableCell>
                      <TableCell align="center">Performance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(methodMetrics).map(([method, data]) => {
                      const totalTime = data.count * data.avgLatency;
                      const performanceColor =
                        data.avgLatency < 100
                          ? 'success'
                          : data.avgLatency < 500
                          ? 'warning'
                          : 'error';

                      return (
                        <TableRow key={method}>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {method}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{data.count}</TableCell>
                          <TableCell align="right">
                            {data.avgLatency.toFixed(2)}ms
                          </TableCell>
                          <TableCell align="right">
                            {totalTime.toFixed(0)}ms
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={
                                data.avgLatency < 100
                                  ? 'Fast'
                                  : data.avgLatency < 500
                                  ? 'Normal'
                                  : 'Slow'
                              }
                              color={performanceColor}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Performance Tips */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Performance Optimization Tips
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Alert severity="info">
                  <Typography variant="subtitle2" gutterBottom>
                    Reduce Latency
                  </Typography>
                  <Typography variant="body2">
                    • Use field masks to request only needed data<br />
                    • Implement pagination for large lists<br />
                    • Enable gRPC compression for large payloads<br />
                    • Consider caching frequently accessed data
                  </Typography>
                </Alert>
              </Grid>
              <Grid item xs={12} md={6}>
                <Alert severity="success">
                  <Typography variant="subtitle2" gutterBottom>
                    Best Practices
                  </Typography>
                  <Typography variant="body2">
                    • Reuse client connections<br />
                    • Handle errors gracefully with retries<br />
                    • Monitor stream health and reconnect<br />
                    • Use deadlines for all RPC calls
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default MetricsPanel;