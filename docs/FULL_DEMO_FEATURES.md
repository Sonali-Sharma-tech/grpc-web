# Full gRPC-Web Demo Features

This document describes all features currently implemented in this comprehensive gRPC-Web demo application.

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React App     │────▶│   Envoy Proxy   │────▶│  Python gRPC    │
│   (Frontend)    │     │   (gRPC-Web)    │     │    Server       │
│   Port: 3001    │     │   Port: 8081    │     │   Port: 50051   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Frontend Components

### 1. CreateTaskForm (`frontend/src/components/CreateTaskForm.tsx`)
- Create new tasks with title, description, priority
- Dynamic label addition/removal
- Form validation
- Loading states during submission

### 2. TaskList (`frontend/src/components/TaskList.tsx`)
- Display all tasks with status and priority chips
- Edit tasks via modal dialog
- Delete tasks with confirmation
- Status and priority updates

### 3. StreamingDemo (`frontend/src/components/StreamingDemo.tsx`)
- Real-time task event streaming (Server Streaming RPC)
- Start/stop stream controls
- Event filtering options (initial state, TODO tasks only)
- Stream statistics tracking
- Event type visualization (CREATE, UPDATE, DELETE)

### 4. MetricsPanel (`frontend/src/components/MetricsPanel.tsx`)
- Total requests counter
- Error rate calculation
- Average latency monitoring
- Method-specific performance table
- Refresh metrics functionality

### 5. ConnectionStatus (`frontend/src/components/ConnectionStatus.tsx`)
- Visual connection state indicator
- Animated status icon
- Real-time connectivity feedback

---

## gRPC Methods

### Unary RPCs (Request-Response)
| Method | Description |
|--------|-------------|
| `CreateTask` | Create a new task |
| `GetTask` | Get task by ID |
| `UpdateTask` | Update existing task |
| `DeleteTask` | Delete task by ID |
| `ListTasks` | List tasks with filtering, pagination, sorting |

### Streaming RPCs
| Method | Type | Description |
|--------|------|-------------|
| `WatchTasks` | Server Streaming | Real-time task event updates |
| `BulkCreateTasks` | Client Streaming | Create multiple tasks in one stream |
| `ProcessTaskStream` | Bidirectional | Interactive command/result processing |

---

## gRPC Client Features (`frontend/src/services/grpcClient.ts`)

### Core Features
- Client initialization with hostname configuration
- Metadata/header handling for authentication
- Error handling with toast notifications
- gRPC status code handling (UNAUTHENTICATED, NOT_FOUND, etc.)

### Advanced Features
- **PerformanceTracker**: Latency recording per method
- **Active Streams Management**: Track and cleanup streams
- **Bulk Operations**: Sequential task creation with error tracking
- **Bidirectional Simulation**: Command processing with results

### Public Endpoint Integration (ngrok)
```typescript
// Header to skip ngrok browser warning
'ngrok-skip-browser-warning': 'true'

// Environment variable for endpoint URL
REACT_APP_GRPC_WEB_URL=http://localhost:8081  // or ngrok URL
```

---

## Docker Services

### Development (`docker-compose.yml`)

| Service | Port | Description |
|---------|------|-------------|
| `backend` | 50051 | Python gRPC server |
| `envoy` | 8081, 9901 | gRPC-Web proxy + admin |
| `frontend` | 3001 | React development server |
| `protogen` | - | Protocol buffer code generation |
| `prometheus` | 9090 | Metrics collection (optional) |
| `grafana` | 3000 | Metrics visualization (optional) |

### Production (`docker-compose.prod.yml`)
- All development services plus:
- Redis for caching/sessions
- PostgreSQL for persistent storage
- SSL/TLS volume mounts
- Resource limits and restart policies

---

## Running the Application

### Local Server Setup

```bash
# Start all services
docker-compose up --build

# Or use the start script
./scripts/start_all.sh
```

**Access Points:**
- Frontend: http://localhost:3001
- gRPC-Web Proxy: http://localhost:8081
- Envoy Admin: http://localhost:9901

### Public Endpoint Setup (ngrok)

1. Start the local services:
```bash
docker-compose up --build
```

2. Expose the Envoy proxy via ngrok:
```bash
ngrok http 8081
```

3. Update the frontend environment variable:
```bash
# In docker-compose.yml or .env file
REACT_APP_GRPC_WEB_URL=https://your-ngrok-url.ngrok.io
```

4. Restart the frontend to use the new URL.

---

## Proto Definition (`proto/task_service.proto`)

### Task Message
```protobuf
message Task {
  string id = 1;
  string title = 2;
  string description = 3;
  TaskStatus status = 4;
  Priority priority = 5;
  repeated string labels = 6;
  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Timestamp updated_at = 8;
  google.protobuf.Timestamp due_date = 9;
  string assigned_to = 10;
  map<string, string> metadata = 11;
}
```

### Enums
- **TaskStatus**: TODO, IN_PROGRESS, DONE, CANCELLED
- **Priority**: LOW, MEDIUM, HIGH, URGENT
- **EventType**: CREATED, UPDATED, DELETED

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/generate_all_protos.sh` | Generate Python and JS protobuf files |
| `scripts/generate_protos.sh` | Generate protobuf files |
| `scripts/start_all.sh` | Start all services with health checks |
| `scripts/stop_all.sh` | Stop all running services |
| `scripts/test_grpc.py` | Test gRPC endpoints |

---

## Monitoring (Optional)

### Enable Prometheus/Grafana
```bash
docker-compose --profile monitoring up
```

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `frontend/src/App.tsx` | Main app with tabs UI |
| `frontend/src/services/grpcClient.ts` | gRPC-Web client wrapper |
| `backend/server.py` | Python gRPC server implementation |
| `proto/task_service.proto` | Protocol buffer definitions |
| `envoy/envoy.yaml` | Envoy proxy configuration |
| `docker-compose.yml` | Development services |
| `docker-compose.prod.yml` | Production services |
