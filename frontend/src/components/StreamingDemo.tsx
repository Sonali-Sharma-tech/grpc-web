import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Switch,
  FormControlLabel,
  Grid,
  Paper,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Stream as StreamIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import * as grpcWeb from 'grpc-web';
import {
  TaskServiceClient,
  TaskEvent,
  EventType,
  TaskStatus,
} from '../services/grpcClient';
import toast from 'react-hot-toast';

interface StreamingDemoProps {
  client: TaskServiceClient;
}

/**
 * Streaming Demo Component
 *
 * Demonstrates:
 * - Server streaming RPC (WatchTasks)
 * - Real-time task updates
 * - Stream lifecycle management
 * - Event filtering
 */
const StreamingDemo: React.FC<StreamingDemoProps> = ({ client }) => {
  const [stream, setStream] = useState<grpcWeb.ClientReadableStream<TaskEvent> | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [filters, setFilters] = useState({
    includeInitial: true,
    todoOnly: false,
  });
  const [streamStats, setStreamStats] = useState({
    eventsReceived: 0,
    startTime: null as Date | null,
    duration: 0,
  });

  // Update stream duration every second
  useEffect(() => {
    if (!isStreaming || !streamStats.startTime) return;

    const interval = setInterval(() => {
      setStreamStats(prev => ({
        ...prev,
        duration: Math.floor((Date.now() - prev.startTime!.getTime()) / 1000),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming, streamStats.startTime]);

  const startStream = () => {
    if (stream) {
      stream.cancel();
    }

    // Clear previous events
    setEvents([]);
    setStreamStats({
      eventsReceived: 0,
      startTime: new Date(),
      duration: 0,
    });

    // Configure stream options
    const streamOptions = {
      includeInitial: filters.includeInitial,
      statuses: filters.todoOnly ? [TaskStatus.TASK_STATUS_TODO] : undefined,
    };

    // Start watching tasks
    const newStream = client.watchTasks(
      (event: TaskEvent) => {
        console.log('Event received:', event);
        setEvents(prev => [event, ...prev].slice(0, 50)); // Keep last 50 events
        setStreamStats(prev => ({
          ...prev,
          eventsReceived: prev.eventsReceived + 1,
        }));
      },
      streamOptions
    );

    setStream(newStream);
    setIsStreaming(true);
    toast.success('Stream started! Watching for task events...');
  };

  const stopStream = () => {
    if (stream) {
      stream.cancel();
      setStream(null);
    }
    setIsStreaming(false);
    toast('Stream stopped');
  };

  const getEventIcon = (eventType: EventType) => {
    switch (eventType) {
      case EventType.EVENT_TYPE_CREATED:
        return <AddIcon color="success" />;
      case EventType.EVENT_TYPE_UPDATED:
        return <EditIcon color="primary" />;
      case EventType.EVENT_TYPE_DELETED:
        return <DeleteIcon color="error" />;
      default:
        return <StreamIcon />;
    }
  };

  const getEventTypeName = (eventType: EventType) => {
    switch (eventType) {
      case EventType.EVENT_TYPE_CREATED:
        return 'Created';
      case EventType.EVENT_TYPE_UPDATED:
        return 'Updated';
      case EventType.EVENT_TYPE_DELETED:
        return 'Deleted';
      default:
        return 'Unknown';
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Grid container spacing={3}>
      {/* Control Panel */}
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Server Streaming Control
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" paragraph>
                Server streaming allows the server to send multiple responses
                to a single client request. Perfect for real-time updates!
              </Typography>
            </Box>

            {/* Stream Controls */}
            <Box sx={{ mb: 2 }}>
              <Button
                fullWidth
                variant="contained"
                color={isStreaming ? 'error' : 'primary'}
                startIcon={isStreaming ? <StopIcon /> : <PlayIcon />}
                onClick={isStreaming ? stopStream : startStream}
              >
                {isStreaming ? 'Stop Stream' : 'Start Stream'}
              </Button>
            </Box>

            {/* Filters */}
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={filters.includeInitial}
                    onChange={(e) =>
                      setFilters({ ...filters, includeInitial: e.target.checked })
                    }
                    disabled={isStreaming}
                  />
                }
                label="Include initial task state"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={filters.todoOnly}
                    onChange={(e) =>
                      setFilters({ ...filters, todoOnly: e.target.checked })
                    }
                    disabled={isStreaming}
                  />
                }
                label="Watch TODO tasks only"
              />
            </Box>

            {/* Stream Stats */}
            {isStreaming && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Stream Statistics
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Duration:</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {formatDuration(streamStats.duration)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Events Received:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {streamStats.eventsReceived}
                  </Typography>
                </Box>
              </Paper>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              How It Works
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              1. Start the stream to watch for task events
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              2. Create, update, or delete tasks in the main tab
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              3. See real-time events appear here instantly!
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              gRPC-Web supports server streaming natively, enabling real-time
              updates without polling!
            </Alert>
          </CardContent>
        </Card>
      </Grid>

      {/* Event Stream */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Real-time Event Stream
            </Typography>

            {isStreaming && <LinearProgress sx={{ mb: 2 }} />}

            {events.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <StreamIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  {isStreaming
                    ? 'Waiting for task events...'
                    : 'Start the stream to see real-time events'}
                </Typography>
              </Box>
            ) : (
              <List sx={{ maxHeight: 600, overflow: 'auto' }}>
                {events.map((event, index) => {
                  const task = event.getTask();
                  const eventType = event.getEventType();
                  const timestamp = event.getTimestamp();

                  return (
                    <ListItem
                      key={index}
                      sx={{
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                    >
                      <ListItemIcon>{getEventIcon(eventType)}</ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={getEventTypeName(eventType)}
                              size="small"
                              color={
                                eventType === EventType.EVENT_TYPE_CREATED
                                  ? 'success'
                                  : eventType === EventType.EVENT_TYPE_UPDATED
                                  ? 'primary'
                                  : 'error'
                              }
                            />
                            <Typography variant="body1">
                              {task?.getTitle() || 'Unknown Task'}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {task?.getDescription() || 'No description'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {timestamp &&
                                format(
                                  timestamp.toDate(),
                                  'MMM dd, yyyy HH:mm:ss.SSS'
                                )}
                              {' • '}
                              Triggered by: {event.getTriggeredBy() || 'Unknown'}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default StreamingDemo;