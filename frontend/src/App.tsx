import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  AppBar,
  Toolbar,
  Grid,
  Card,
  CardContent,
  Tab,
  Tabs,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Toaster } from 'react-hot-toast';

// Import components
import TaskList from './components/TaskList';
import CreateTaskForm from './components/CreateTaskForm';
import StreamingDemo from './components/StreamingDemo';
import MetricsPanel from './components/MetricsPanel';
import ConnectionStatus from './components/ConnectionStatus';

// Import gRPC service
import { TaskServiceClient, defaultClient } from './services/grpcClient';
import { Task } from './generated/index';

// Tab panel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

/**
 * Main App Component
 *
 * Demonstrates:
 * - gRPC-Web client initialization
 * - Multiple RPC patterns (Unary, Streaming)
 * - Real-time updates
 * - Error handling
 * - Performance metrics
 */
function App() {
  const [client, setClient] = useState<TaskServiceClient | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [metrics, setMetrics] = useState({
    totalRequests: 0,
    errors: 0,
    averageLatency: 0,
    activeStreams: 0,
  });

  // Initialize gRPC-Web client
  useEffect(() => {
    setClient(defaultClient);

    // Test connection
    defaultClient.checkConnection()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));

    return () => {
      // Cleanup on unmount
      defaultClient.close();
    };
  }, []);

  // Load initial tasks
  const loadTasks = useCallback(async () => {
    if (!client) return;

    setLoading(true);
    try {
      const tasksList = await client.listTasks({
        pageSize: 50,
      });
      setTasks(tasksList);
      setMetrics(prev => ({
        ...prev,
        totalRequests: prev.totalRequests + 1,
      }));
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setMetrics(prev => ({
        ...prev,
        errors: prev.errors + 1,
      }));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (client && connected) {
      loadTasks();
    }
  }, [client, connected, loadTasks]);

  // Handle task creation
  const handleTaskCreated = (task: Task) => {
    setTasks(prev => [task, ...prev]);
  };

  // Handle task update
  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks(prev =>
      prev.map(task =>
        task.getId() === updatedTask.getId() ? updatedTask : task
      )
    );
  };

  // Handle task deletion
  const handleTaskDeleted = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.getId() !== taskId));
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Toaster position="top-right" />

      {/* App Bar */}
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            gRPC-Web Demo Application
          </Typography>
          <ConnectionStatus connected={connected} />
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        {/* Welcome Section */}
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Welcome to the gRPC-Web Demo
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            This application demonstrates all aspects of gRPC-Web communication
            including unary calls, server streaming, client streaming, and
            bidirectional streaming (simulated).
          </Typography>

          {/* Architecture Overview */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Architecture Flow:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip label="React App" color="primary" />
              <Typography>→</Typography>
              <Chip label="gRPC-Web" color="secondary" />
              <Typography>→</Typography>
              <Chip label="Envoy Proxy" color="warning" />
              <Typography>→</Typography>
              <Chip label="Python gRPC Server" color="success" />
            </Box>
          </Box>
        </Paper>

        {/* Main Content Tabs */}
        <Paper sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="demo tabs"
            >
              <Tab label="Task Management" />
              <Tab label="Streaming Demo" />
              <Tab label="Metrics & Performance" />
            </Tabs>
          </Box>

          {/* Task Management Tab */}
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              {/* Create Task Form */}
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Create New Task
                    </Typography>
                    {client && connected ? (
                      <CreateTaskForm
                        client={client}
                        onTaskCreated={handleTaskCreated}
                      />
                    ) : (
                      <Typography color="text.secondary">
                        Connecting to server...
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Task List */}
              <Grid item xs={12} md={8}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Task List (Unary RPC)
                    </Typography>
                    {loading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                      </Box>
                    ) : (
                      <TaskList
                        tasks={tasks}
                        client={client}
                        onTaskUpdated={handleTaskUpdated}
                        onTaskDeleted={handleTaskDeleted}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Streaming Demo Tab */}
          <TabPanel value={tabValue} index={1}>
            {client && connected ? (
              <StreamingDemo client={client} />
            ) : (
              <Typography color="text.secondary">
                Connecting to server...
              </Typography>
            )}
          </TabPanel>

          {/* Metrics Tab */}
          <TabPanel value={tabValue} index={2}>
            <MetricsPanel metrics={metrics} client={client} />
          </TabPanel>
        </Paper>

        {/* Info Section */}
        <Box sx={{ mt: 4, mb: 2 }}>
          <Typography variant="body2" color="text.secondary" align="center">
            This demo showcases gRPC-Web capabilities including authentication,
            error handling, streaming, and performance monitoring.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default App;