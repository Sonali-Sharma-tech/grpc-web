# Simple Todo App Guide

This document describes the minimal setup for a simple gRPC-Web todo application with local server and public endpoint support.

---

## Architecture (Simplified)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React App     │────▶│   Envoy Proxy   │────▶│  Python gRPC    │
│   (Frontend)    │     │   (gRPC-Web)    │     │    Server       │
│   Port: 3001    │     │   Port: 8081    │     │   Port: 50051   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Only 3 services needed** - no monitoring, no extra databases.

---

## What You Need (Essential Files Only)

### Frontend Components (2 only)

| Component | Purpose |
|-----------|---------|
| `CreateTaskForm.tsx` | Form to create new tasks |
| `TaskList.tsx` | Display, edit, and delete tasks |

### gRPC Methods (5 only - CRUD)

| Method | Description |
|--------|-------------|
| `CreateTask` | Create a new task |
| `GetTask` | Get task by ID |
| `UpdateTask` | Update existing task |
| `DeleteTask` | Delete task by ID |
| `ListTasks` | List all tasks |

### Docker Services (3 only)

| Service | Port | Description |
|---------|------|-------------|
| `backend` | 50051 | Python gRPC server |
| `envoy` | 8081 | gRPC-Web proxy |
| `frontend` | 3001 | React app |

---

## What to Remove (from current project)

### Frontend Components to Remove
- `StreamingDemo.tsx` - streaming demo not needed
- `MetricsPanel.tsx` - metrics tracking not needed
- `ConnectionStatus.tsx` - nice-to-have but not essential

### App.tsx Simplifications
- Remove Tabs UI (show task list directly)
- Remove metrics state tracking
- Remove welcome/architecture section
- Remove "Streaming Demo" and "Metrics" tabs

### grpcClient.ts Simplifications
- Remove `PerformanceTracker` class
- Remove `watchTasks()` method
- Remove `bulkCreateTasks()` method
- Remove `processTaskStream()` method
- Remove `getMetrics()` method
- Remove active streams tracking

### Proto Methods to Remove
- `WatchTasks` (Server Streaming)
- `BulkCreateTasks` (Client Streaming)
- `ProcessTaskStream` (Bidirectional Streaming)

### Docker Services to Remove
- `protogen` - run manually when needed
- `prometheus` - not needed
- `grafana` - not needed
- Entire `docker-compose.prod.yml`

---

## Simplified Project Structure

```
grpc-web-demo/
├── proto/
│   └── task_service.proto      # CRUD methods only
├── backend/
│   ├── Dockerfile
│   ├── server.py               # CRUD handlers only
│   ├── requirements.txt
│   └── generated/
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx             # Simple layout, no tabs
│   │   ├── index.tsx
│   │   ├── components/
│   │   │   ├── CreateTaskForm.tsx
│   │   │   └── TaskList.tsx
│   │   ├── services/
│   │   │   └── grpcClient.ts   # CRUD methods only
│   │   └── generated/
├── envoy/
│   └── envoy.yaml
├── docker-compose.yml          # 3 services only
└── README.md
```

---

## Simplified docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: ./backend/Dockerfile
    container_name: grpc-backend
    ports:
      - "50051:50051"
    networks:
      - grpc-network

  envoy:
    image: envoyproxy/envoy:v1.28-latest
    container_name: grpc-envoy
    ports:
      - "8081:8080"
    volumes:
      - ./envoy/envoy.yaml:/etc/envoy/envoy.yaml
    networks:
      - grpc-network
    depends_on:
      - backend

  frontend:
    build:
      context: .
      dockerfile: ./frontend/Dockerfile
    container_name: grpc-frontend
    ports:
      - "3001:3000"
    environment:
      - REACT_APP_GRPC_WEB_URL=http://localhost:8081
    networks:
      - grpc-network
    depends_on:
      - envoy

networks:
  grpc-network:
    driver: bridge
```

---

## Simplified grpcClient.ts

```typescript
import * as grpcWeb from 'grpc-web';
import {
  TaskServiceClient as GeneratedClient,
  Task,
  CreateTaskRequest,
  GetTaskRequest,
  UpdateTaskRequest,
  DeleteTaskRequest,
  ListTasksRequest,
  ListTasksResponse,
  TaskStatus,
  Priority,
} from '../generated/index';

export { Task, TaskStatus, Priority };

export class TaskServiceClient {
  private client: GeneratedClient;
  private metadata: grpcWeb.Metadata;

  constructor(hostname: string = 'http://localhost:8081') {
    this.client = new GeneratedClient(hostname, null, null);
    this.metadata = {
      'ngrok-skip-browser-warning': 'true',  // For public endpoint support
    };
  }

  async createTask(title: string, description: string, priority: Priority = Priority.PRIORITY_MEDIUM): Promise<Task> {
    const request = new CreateTaskRequest();
    request.setTitle(title);
    request.setDescription(description);
    request.setPriority(priority);

    return new Promise((resolve, reject) => {
      this.client.createTask(request, this.metadata, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  async getTask(taskId: string): Promise<Task> {
    const request = new GetTaskRequest();
    request.setId(taskId);

    return new Promise((resolve, reject) => {
      this.client.getTask(request, this.metadata, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  async updateTask(taskId: string, updates: { title?: string; description?: string; status?: TaskStatus; priority?: Priority }): Promise<Task> {
    const request = new UpdateTaskRequest();
    request.setId(taskId);
    if (updates.title) request.setTitle(updates.title);
    if (updates.description) request.setDescription(updates.description);
    if (updates.status) request.setStatus(updates.status);
    if (updates.priority) request.setPriority(updates.priority);

    return new Promise((resolve, reject) => {
      this.client.updateTask(request, this.metadata, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    const request = new DeleteTaskRequest();
    request.setId(taskId);

    return new Promise((resolve, reject) => {
      this.client.deleteTask(request, this.metadata, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async listTasks(): Promise<Task[]> {
    const request = new ListTasksRequest();
    request.setPageSize(100);

    return new Promise((resolve, reject) => {
      this.client.listTasks(request, this.metadata, (err, response) => {
        if (err) reject(err);
        else resolve(response.getTasksList());
      });
    });
  }
}

const GRPC_WEB_URL = process.env.REACT_APP_GRPC_WEB_URL || 'http://localhost:8081';
export const defaultClient = new TaskServiceClient(GRPC_WEB_URL);
```

---

## Simplified App.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Paper, Grid, Card, CardContent } from '@mui/material';
import TaskList from './components/TaskList';
import CreateTaskForm from './components/CreateTaskForm';
import { defaultClient } from './services/grpcClient';
import { Task } from './generated/index';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const tasksList = await defaultClient.listTasks();
      setTasks(tasksList);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleTaskCreated = (task: Task) => {
    setTasks(prev => [task, ...prev]);
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks(prev => prev.map(task =>
      task.getId() === updatedTask.getId() ? updatedTask : task
    ));
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.getId() !== taskId));
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Simple Todo App
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Create Task</Typography>
              <CreateTaskForm client={defaultClient} onTaskCreated={handleTaskCreated} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Tasks</Typography>
              <TaskList
                tasks={tasks}
                client={defaultClient}
                onTaskUpdated={handleTaskUpdated}
                onTaskDeleted={handleTaskDeleted}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

export default App;
```

---

## Running the Simple App

### Local Server Setup

```bash
# Start the 3 essential services
docker-compose up backend envoy frontend --build

# Or if you have a simplified docker-compose.yml
docker-compose up --build
```

**Access:**
- Frontend: http://localhost:3001
- gRPC-Web Proxy: http://localhost:8081

### Public Endpoint Setup (ngrok)

1. Start local services:
```bash
docker-compose up --build
```

2. Expose Envoy proxy via ngrok:
```bash
ngrok http 8081
```

3. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)

4. Update environment variable:
```bash
# Option 1: In docker-compose.yml
environment:
  - REACT_APP_GRPC_WEB_URL=https://abc123.ngrok.io

# Option 2: Create .env file
REACT_APP_GRPC_WEB_URL=https://abc123.ngrok.io
```

5. Restart frontend:
```bash
docker-compose up frontend --build
```

**Note:** The `ngrok-skip-browser-warning` header is already included in the client to bypass ngrok's browser warning page.

---

## Simplified Proto (task_service.proto)

```protobuf
syntax = "proto3";

package taskservice;

import "google/protobuf/empty.proto";
import "google/protobuf/timestamp.proto";

service TaskService {
  rpc CreateTask(CreateTaskRequest) returns (Task);
  rpc GetTask(GetTaskRequest) returns (Task);
  rpc UpdateTask(UpdateTaskRequest) returns (Task);
  rpc DeleteTask(DeleteTaskRequest) returns (google.protobuf.Empty);
  rpc ListTasks(ListTasksRequest) returns (ListTasksResponse);
}

enum TaskStatus {
  TASK_STATUS_UNSPECIFIED = 0;
  TASK_STATUS_TODO = 1;
  TASK_STATUS_IN_PROGRESS = 2;
  TASK_STATUS_DONE = 3;
}

enum Priority {
  PRIORITY_UNSPECIFIED = 0;
  PRIORITY_LOW = 1;
  PRIORITY_MEDIUM = 2;
  PRIORITY_HIGH = 3;
}

message Task {
  string id = 1;
  string title = 2;
  string description = 3;
  TaskStatus status = 4;
  Priority priority = 5;
  google.protobuf.Timestamp created_at = 6;
  google.protobuf.Timestamp updated_at = 7;
}

message CreateTaskRequest {
  string title = 1;
  string description = 2;
  Priority priority = 3;
}

message GetTaskRequest {
  string id = 1;
}

message UpdateTaskRequest {
  string id = 1;
  string title = 2;
  string description = 3;
  TaskStatus status = 4;
  Priority priority = 5;
}

message DeleteTaskRequest {
  string id = 1;
}

message ListTasksRequest {
  int32 page_size = 1;
  string page_token = 2;
}

message ListTasksResponse {
  repeated Task tasks = 1;
  string next_page_token = 2;
}
```

---

## Summary

| Aspect | Full Demo | Simple Todo |
|--------|-----------|-------------|
| Components | 5 | 2 |
| gRPC Methods | 8 (incl. streaming) | 5 (CRUD only) |
| Docker Services | 6 | 3 |
| Features | Streaming, Metrics, Monitoring | Basic CRUD |
| Complexity | High | Low |
