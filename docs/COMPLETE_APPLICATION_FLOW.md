# Building a gRPC-Web Application: Complete Step-by-Step Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Step-by-Step Build Process](#step-by-step-build-process)
4. [Data Flow Explanation](#data-flow-explanation)
5. [Why This Architecture](#why-this-architecture)

## Overview

This guide walks through building a complete gRPC-Web application from scratch, explaining each file's purpose, why it's created in a specific order, and how all components work together.

### Technology Stack
- **Backend**: Python gRPC server
- **Frontend**: React with TypeScript
- **Protocol**: gRPC with Protocol Buffers
- **Proxy**: Envoy (for gRPC-Web translation)
- **Containerization**: Docker & Docker Compose

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Browser   │     │  React App      │     │  Envoy Proxy    │
│                 │────▶│  (Port 3000)    │────▶│  (Port 8080)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              HTTP/1.1                    │
                             gRPC-Web                     │ HTTP/2
                                                         │ gRPC
                                                         ▼
                                                ┌─────────────────┐
                                                │  Python Server  │
                                                │  (Port 50051)   │
                                                └─────────────────┘
```

## Fundamental Concepts: Why We Need Envoy

### HTTP/1.1 vs HTTP/2: The Core Problem

#### Simple Explanation: Think of it Like a Restaurant

**HTTP/1.1 is like a restaurant with one waiter:**
- You order an appetizer → Waiter goes to kitchen → Brings appetizer
- You order main course → Waiter goes to kitchen → Brings main course
- You order dessert → Waiter goes to kitchen → Brings dessert
- **Problem**: Each order requires a separate trip. If you want multiple items, you wait for each trip to complete.

**HTTP/2 is like a restaurant with a smart waiter system:**
- You order appetizer, main course, and dessert all at once
- Multiple waiters can work on your order simultaneously
- Kitchen can send items as they're ready, not in order
- **Benefit**: Everything happens in parallel, much faster!

#### Technical Details

##### What is HTTP/1.1?
- **Released**: 1997 (with updates in 1999)
- **How it works**: Like sending letters through regular mail
  - Each request is a separate "letter"
  - Must wait for response before sending next request
  - Or open multiple "mailboxes" (TCP connections) which is expensive

**What is TCP?**
- TCP (Transmission Control Protocol) = The phone line of the internet
- It's how computers establish a reliable connection to talk to each other
- Think of it like making a phone call:
  1. You dial (establish connection)
  2. They answer (connection accepted)
  3. You talk (data transfer)
  4. You hang up (close connection)
- TCP ensures all data arrives in order and nothing is lost

**Visual Example of HTTP/1.1:**
```
Browser → Request 1 → Wait → Response 1 → Request 2 → Wait → Response 2
         (Get Task)          (Task Data)  (Update Task)      (Success)
```

Example HTTP/1.1 request (human-readable text):
```
GET /api/task/123 HTTP/1.1
Host: example.com
Content-Type: application/json
Accept: application/json
```

##### What is HTTP/2?
- **Released**: 2015
- **How it works**: Like having a phone call
  - Can talk and listen at the same time
  - Multiple topics in one conversation
  - More efficient communication

**Visual Example of HTTP/2:**
```
Browser → Request 1 (Get Task)    → Response 1 (Task Data)
        → Request 2 (Update Task) → Response 2 (Success)
        → Request 3 (List Tasks)  → Response 3 (Task List)
        (All happening simultaneously on one connection!)
```

Key HTTP/2 features visualized:
```
┌─────────────────────────────────────┐
│      ONE Connection to Server       │
├─────────────────────────────────────┤
│ Stream 1: CreateTask Request ✈️     │ ← Multiple "conversations"
│ Stream 2: GetTask Request 🚗        │   happening at once
│ Stream 3: WatchTasks (ongoing) 📺   │   on the same connection
│ Stream 4: UpdateTask Request 🚀     │
└─────────────────────────────────────┘
```

#### The Key Differences That Matter

| Feature | HTTP/1.1 | HTTP/2 |
|---------|----------|--------|
| **Speed** | 🐌 Slower (one at a time) | 🚀 Faster (all at once) |
| **Format** | 📝 Text (human-readable) | 💾 Binary (computer-friendly) |
| **Requests** | 🚶 Sequential (wait in line) | 🏃‍♂️🏃‍♀️ Parallel (everyone runs) |
| **Connection** | 📮 Many connections needed | 📞 One connection for all |
| **Streaming** | ❌ Not possible | ✅ Built-in support |

### Why gRPC Requires HTTP/2

gRPC specifically needs HTTP/2 for these features:

1. **Streaming Support**
   - HTTP/1.1: Can only do request-response (like texting - send message, wait for reply)
   - HTTP/2: Supports bidirectional streaming (like a phone call - both can talk at the same time)

   **What is Streaming?**
   Think of it like the difference between texting and calling:
   - **Regular Request-Response** (HTTP/1.1): Like texting - you send a message, wait for a reply
   - **Streaming** (HTTP/2): Like a phone/video call - continuous flow of data

   **Types of Streaming:**
   ```
   Client ──────> Server (Client streaming)
   Example: Uploading a large file in chunks

   Client <────── Server (Server streaming)
   Example: Live sports scores updates

   Client <────> Server (Bidirectional streaming)
   Example: Video chat - both sides send/receive continuously
   ```

   **What is "Bidirectional"?**
   - "Bi" = Two, "Directional" = Direction
   - Data flows in BOTH directions simultaneously
   - Like a two-way street where cars can go both ways at the same time

2. **Binary Framing**
   - Protocol Buffers are binary
   - HTTP/2's binary framing is a natural fit
   - More efficient than base64-encoding for HTTP/1.1

   **What is Binary vs Text?**
   - **Text**: Human-readable, like "Hello World" or "123"
   - **Binary**: Computer-readable, looks like: 01001000 01100101 01101100
   - Think of it like:
     - Text = Written words in a book (larger, but humans can read)
     - Binary = Morse code or QR codes (smaller, optimized for machines)

   **What is Base64?**
   - A way to convert binary data into text that can be safely transmitted
   - Like putting a fragile item in a padded box for shipping
   - Makes the data 33% larger but ensures it arrives safely

3. **Multiplexing**
   - Multiple RPC calls on one connection
   - No head-of-line blocking
   - Better performance for concurrent calls

   **What is Multiplexing?**
   - Ability to send multiple messages through one connection simultaneously
   - Like multiple TV channels through one cable
   - Imagine a highway with multiple lanes vs a single-lane road

   **What is Head-of-Line Blocking?**
   - When one slow request blocks all others behind it
   - Like being stuck behind a slow car on a single-lane road
   - HTTP/2 solves this with "lanes" (streams) so fast requests can pass slow ones

   **What is RPC?**
   - RPC = Remote Procedure Call
   - Calling a function that runs on another computer
   - Like calling a pizza place - you make a request, they do the work, send back result

### Why Browsers Can't Use gRPC Directly

Browsers have limitations that prevent native gRPC:

1. **Limited HTTP/2 Access**
   - Browsers support HTTP/2, BUT...
   - JavaScript APIs (fetch, XMLHttpRequest) abstract away protocol details
   - Can't access HTTP/2 frames, streams, or trailers directly
   - No control over HTTP/2 specific features

2. **No Binary Frame Control**
   ```javascript
   // What browsers allow:
   fetch('/api/task', {
     method: 'POST',
     body: JSON.stringify({title: 'New Task'})
   });

   // What gRPC needs (not possible in browsers):
   // - Direct HTTP/2 frame manipulation
   // - Custom header frames
   // - Binary protocol buffer data
   // - Stream management
   ```

3. **Security Restrictions**
   - Browsers enforce CORS (Cross-Origin Resource Sharing)
   - Can't make arbitrary TCP connections
   - Limited to HTTP(S) protocols

   **What is CORS?**
   - CORS = Cross-Origin Resource Sharing
   - A security feature that controls which websites can access your data
   - Like a bouncer at a club checking IDs - only approved origins get in
   - Example: Website A can't just steal data from Website B without permission

   **What are Arbitrary TCP Connections?**
   - "Arbitrary" = Any/Random
   - Browsers can't just connect to any computer on any port
   - Like how you can't just walk into any building - you need permission
   - This protects users from malicious websites

### How Envoy Solves This: The Translation Layer

Envoy acts as a translator between what browsers can do and what gRPC needs:

```
Browser → gRPC-Web → Envoy → gRPC → Server
```

#### The Translation Process:

1. **Browser sends gRPC-Web request (HTTP/1.1)**:
   ```
   POST /taskservice.TaskService/CreateTask HTTP/1.1
   Content-Type: application/grpc-web+proto
   X-Grpc-Web: 1

   [Base64 encoded Protocol Buffer data]
   ```

2. **Envoy receives and translates**:
   - Decodes base64 data to binary
   - Creates proper HTTP/2 frames
   - Sets gRPC headers
   - Manages HTTP/2 streams

3. **Envoy sends gRPC request (HTTP/2)**:
   ```
   :method: POST
   :path: /taskservice.TaskService/CreateTask
   content-type: application/grpc+proto

   [Binary Protocol Buffer data]
   ```

4. **Response translation**:
   - Receives HTTP/2 response with trailers
   - Encodes binary data to base64
   - Converts to HTTP/1.1 response
   - Handles streaming by chunking

#### Streaming Translation

For streaming RPCs, Envoy performs special handling:

**Server Streaming Example**:
```
Browser                    Envoy                     gRPC Server
   │                         │                           │
   ├──HTTP/1.1 Request──────>│                           │
   │                         ├──HTTP/2 Stream Open─────>│
   │                         │<──Frame 1 (Task Event)───│
   │<──Chunk 1 (base64)──────│                           │
   │                         │<──Frame 2 (Task Event)───│
   │<──Chunk 2 (base64)──────│                           │
   │                         │<──Frame 3 + Trailers────│
   │<──Final Chunk + Status──│                           │
```

### Why Not Just Use REST/JSON?

You might wonder: "Why not use regular REST APIs with JSON?"

| Aspect | REST/JSON | gRPC-Web |
|--------|-----------|----------|
| Type Safety | Manual validation | Generated from .proto |
| Performance | Larger payloads (text) | Smaller (binary) |
| Streaming | Polling/WebSockets | Native support |
| Code Generation | Manual client code | Auto-generated |
| API Contract | OpenAPI (optional) | .proto (required) |

### Real-World Analogy

Think of it like international communication:
- **Your Browser**: Speaks only English (HTTP/1.1)
- **gRPC Server**: Speaks only Mandarin (HTTP/2 + gRPC)
- **Envoy**: Professional translator who speaks both

Without Envoy, they can't communicate. Envoy doesn't just translate words—it handles cultural differences (protocol specifics), ensures nothing is lost in translation (data integrity), and manages the conversation flow (streaming).

## Step-by-Step Build Process

### Step 1: Define the API Contract - Protocol Buffer File

**File**: `proto/task_service.proto`

**Why First?** This is the foundation of any gRPC application. It defines:
- Data structures (messages)
- Service interfaces (RPC methods)
- Type safety across languages

```protobuf
syntax = "proto3";

package taskservice;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

// ===== DATA MODELS =====

// Core data model
message Task {
  string id = 1;
  string title = 2;
  string description = 3;
  TaskStatus status = 4;
  Priority priority = 5;
  google.protobuf.Timestamp created_at = 6;
  google.protobuf.Timestamp updated_at = 7;
  repeated string labels = 8;
  map<string, string> metadata = 9;
}

// Enums for type safety
enum TaskStatus {
  TASK_STATUS_UNSPECIFIED = 0;
  TASK_STATUS_TODO = 1;
  TASK_STATUS_IN_PROGRESS = 2;
  TASK_STATUS_DONE = 3;
  TASK_STATUS_CANCELLED = 4;
}

enum Priority {
  PRIORITY_UNSPECIFIED = 0;
  PRIORITY_LOW = 1;
  PRIORITY_MEDIUM = 2;
  PRIORITY_HIGH = 3;
  PRIORITY_CRITICAL = 4;
}

// ===== REQUEST/RESPONSE MESSAGES =====

message CreateTaskRequest {
  string title = 1;
  string description = 2;
  Priority priority = 3;
  repeated string labels = 4;
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
  string filter = 1;
  int32 page_size = 2;
  string page_token = 3;
}

message ListTasksResponse {
  repeated Task tasks = 1;
  string next_page_token = 2;
  int32 total_count = 3;
}

// ===== STREAMING MESSAGES =====

message WatchTasksRequest {
  string filter = 1;
}

message TaskEvent {
  EventType event_type = 1;
  Task task = 2;
  google.protobuf.Timestamp timestamp = 3;
}

enum EventType {
  EVENT_TYPE_UNSPECIFIED = 0;
  EVENT_TYPE_CREATED = 1;
  EVENT_TYPE_UPDATED = 2;
  EVENT_TYPE_DELETED = 3;
}

// ===== SERVICE DEFINITION =====

service TaskService {
  // Unary RPCs (request-response)
  rpc CreateTask(CreateTaskRequest) returns (Task);
  rpc GetTask(GetTaskRequest) returns (Task);
  rpc UpdateTask(UpdateTaskRequest) returns (Task);
  rpc DeleteTask(DeleteTaskRequest) returns (google.protobuf.Empty);
  rpc ListTasks(ListTasksRequest) returns (ListTasksResponse);

  // Server streaming RPC
  rpc WatchTasks(WatchTasksRequest) returns (stream TaskEvent);

  // Client streaming RPC (example)
  rpc BulkCreateTasks(stream CreateTaskRequest) returns (BulkCreateResponse);
}
```

**Key Concepts Explained**:
- **Messages**: Define data structures
  - Like creating a form template - specifies what fields exist and their types
  - Example: A "Task" message has fields for title, description, status, etc.

- **Enums**: Provide type-safe constants
  - A fixed set of named values (like multiple choice options)
  - Example: TaskStatus can only be TODO, IN_PROGRESS, DONE, or CANCELLED
  - Prevents typos and invalid values

- **Services**: Define RPC methods
  - Like a restaurant menu - lists all available operations
  - Each method specifies what it receives and what it returns

- **Streaming**: Enables real-time communication
  - Continuous data flow instead of one-time request/response
  - Perfect for live updates, progress tracking, chat applications

**What are Protocol Buffers?**
- A language-neutral way to define data structure
- Like a blueprint that works in any programming language
- Automatically generates code for different languages
- More efficient than JSON (smaller size, faster parsing)

### Step 2: Generate Code from Proto Files

**File**: `scripts/generate_all_protos.sh`

**Why**: Automates code generation for both backend and frontend.

```bash
#!/bin/bash
# Generate Protocol Buffer files for all languages

echo "Generating Protocol Buffer files..."

# Generate Python files for backend
python -m grpc_tools.protoc \
    -I/proto \
    --python_out=/backend/generated \
    --grpc_python_out=/backend/generated \
    /proto/task_service.proto

echo "Python protobuf files generated!"

# Generate JavaScript files for frontend
if command -v protoc-gen-js &> /dev/null; then
    protoc -I=/proto \
        --js_out=import_style=commonjs:/frontend/generated \
        --grpc-web_out=import_style=commonjs,mode=grpcwebtext:/frontend/generated \
        /proto/task_service.proto
    echo "JavaScript protobuf files generated!"
else
    echo "Warning: protoc-gen-js not found, skipping JavaScript generation"
fi

echo "Protobuf generation complete!"
```

### Step 3: Backend Implementation

**File**: `backend/server.py`

**Purpose**: Implements the business logic for all RPC methods defined in the proto file.

```python
import grpc
from concurrent import futures
import logging
import uuid
import time
from queue import Queue
from threading import Lock
import sys
sys.path.append('./generated')

import task_service_pb2
import task_service_pb2_grpc
from google.protobuf.timestamp_pb2 import Timestamp
from google.protobuf.empty_pb2 import Empty

class TaskServiceServicer(task_service_pb2_grpc.TaskServiceServicer):
    """Implementation of TaskService RPC methods"""

    def __init__(self):
        # In-memory storage (in production, use a database)
        self.tasks = {}
        self.tasks_lock = Lock()

        # Event queues for streaming
        self.event_queues = []
        self.queues_lock = Lock()

        logging.info("TaskService initialized")

    def CreateTask(self, request, context):
        """Create a new task"""
        # Generate unique ID
        task_id = str(uuid.uuid4())

        # Create task object
        task = task_service_pb2.Task(
            id=task_id,
            title=request.title,
            description=request.description,
            status=task_service_pb2.TASK_STATUS_TODO,
            priority=request.priority or task_service_pb2.PRIORITY_MEDIUM
        )

        # Set timestamps
        now = Timestamp()
        now.GetCurrentTime()
        task.created_at.CopyFrom(now)
        task.updated_at.CopyFrom(now)

        # Add labels
        task.labels.extend(request.labels)

        # Store task
        with self.tasks_lock:
            self.tasks[task_id] = task

        # Notify watchers
        self._broadcast_event(
            task_service_pb2.EVENT_TYPE_CREATED,
            task
        )

        logging.info(f"Created task: {task_id}")
        return task

    def GetTask(self, request, context):
        """Get a single task by ID"""
        with self.tasks_lock:
            if request.id not in self.tasks:
                context.set_code(grpc.StatusCode.NOT_FOUND)
                context.set_details(f'Task {request.id} not found')
                return task_service_pb2.Task()

            return self.tasks[request.id]

    def UpdateTask(self, request, context):
        """Update an existing task"""
        with self.tasks_lock:
            if request.id not in self.tasks:
                context.set_code(grpc.StatusCode.NOT_FOUND)
                context.set_details(f'Task {request.id} not found')
                return task_service_pb2.Task()

            # Update fields
            task = self.tasks[request.id]
            if request.title:
                task.title = request.title
            if request.description:
                task.description = request.description
            if request.status:
                task.status = request.status
            if request.priority:
                task.priority = request.priority

            # Update timestamp
            now = Timestamp()
            now.GetCurrentTime()
            task.updated_at.CopyFrom(now)

        # Notify watchers
        self._broadcast_event(
            task_service_pb2.EVENT_TYPE_UPDATED,
            task
        )

        logging.info(f"Updated task: {request.id}")
        return task

    def DeleteTask(self, request, context):
        """Delete a task"""
        with self.tasks_lock:
            if request.id not in self.tasks:
                context.set_code(grpc.StatusCode.NOT_FOUND)
                context.set_details(f'Task {request.id} not found')
                return Empty()

            task = self.tasks.pop(request.id)

        # Notify watchers
        self._broadcast_event(
            task_service_pb2.EVENT_TYPE_DELETED,
            task
        )

        logging.info(f"Deleted task: {request.id}")
        return Empty()

    def ListTasks(self, request, context):
        """List tasks with pagination"""
        with self.tasks_lock:
            all_tasks = list(self.tasks.values())

        # Apply filter if provided
        if request.filter:
            all_tasks = [t for t in all_tasks if request.filter.lower() in t.title.lower()]

        # Pagination
        page_size = request.page_size or 10
        start = 0
        if request.page_token:
            start = int(request.page_token)

        end = start + page_size
        tasks = all_tasks[start:end]

        # Prepare response
        response = task_service_pb2.ListTasksResponse(
            tasks=tasks,
            total_count=len(all_tasks)
        )

        if end < len(all_tasks):
            response.next_page_token = str(end)

        return response

    def WatchTasks(self, request, context):
        """Stream task events to clients"""
        # Create a queue for this client
        event_queue = Queue()

        with self.queues_lock:
            self.event_queues.append(event_queue)

        try:
            # Send initial snapshot
            with self.tasks_lock:
                for task in self.tasks.values():
                    event = task_service_pb2.TaskEvent(
                        event_type=task_service_pb2.EVENT_TYPE_CREATED,
                        task=task
                    )
                    now = Timestamp()
                    now.GetCurrentTime()
                    event.timestamp.CopyFrom(now)
                    yield event

            # Stream updates
            while context.is_active():
                try:
                    # Wait for events with timeout
                    event = event_queue.get(timeout=1.0)
                    yield event
                except:
                    # Timeout - send heartbeat
                    continue

        finally:
            # Clean up
            with self.queues_lock:
                self.event_queues.remove(event_queue)
            logging.info("Client disconnected from WatchTasks")

    def _broadcast_event(self, event_type, task):
        """Broadcast event to all watchers"""
        event = task_service_pb2.TaskEvent(
            event_type=event_type,
            task=task
        )
        now = Timestamp()
        now.GetCurrentTime()
        event.timestamp.CopyFrom(now)

        with self.queues_lock:
            for queue in self.event_queues:
                try:
                    queue.put_nowait(event)
                except:
                    # Queue full, skip
                    pass

def serve():
    """Start the gRPC server"""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Create server with thread pool
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    # Add service
    task_service_pb2_grpc.add_TaskServiceServicer_to_server(
        TaskServiceServicer(), server
    )

    # Bind to port
    port = '[::]:50051'
    server.add_insecure_port(port)

    # Start server
    server.start()
    logging.info(f"Server started on {port}")

    # Wait for termination
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logging.info("Shutting down server...")
        server.stop(grace_period=10)

if __name__ == '__main__':
    serve()
```

**Key Implementation Details**:
- **Thread-safe operations with locks**
  - **What is Thread-Safe?** When multiple things can happen at once without breaking
  - **What are Locks?** Like a bathroom door lock - only one person can use it at a time
  - Prevents data corruption when multiple users modify tasks simultaneously
  - Example: Two users updating the same task won't cause conflicts

- **Real-time event broadcasting**
  - **What is Broadcasting?** Sending the same message to everyone listening
  - Like a radio station - transmit once, everyone with a radio receives it
  - When one user creates a task, all connected users see it instantly

- **Error handling with gRPC status codes**
  - **What are Status Codes?** Standard numbers that indicate what went wrong
  - Like HTTP status codes (404 = Not Found, 500 = Server Error)
  - Examples:
    - NOT_FOUND: Task doesn't exist
    - INVALID_ARGUMENT: Bad input data
    - PERMISSION_DENIED: Not authorized

- **Pagination support**
  - **What is Pagination?** Breaking large lists into smaller pages
  - Like pages in a book - instead of one huge page, you get manageable chunks
  - Improves performance and user experience
  - Example: Show 10 tasks at a time instead of 1000

- **Logging for debugging**
  - **What is Logging?** Recording what happens in your app
  - Like a diary or flight recorder - helps diagnose problems
  - Shows who did what and when
  - Essential for troubleshooting issues in production

### Step 4: Envoy Proxy Configuration

**File**: `envoy/envoy.yaml`

**Purpose**: Translates between gRPC-Web (HTTP/1.1) and gRPC (HTTP/2) since browsers can't speak native gRPC.

```yaml
admin:
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 9901

static_resources:
  listeners:
  - name: listener_0
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 8080
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          codec_type: AUTO
          stat_prefix: ingress_http
          access_log:
          - name: envoy.access_loggers.stdout
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.access_loggers.stream.v3.StdoutAccessLog
          route_config:
            name: local_route
            virtual_hosts:
            - name: backend
              domains: ["*"]
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: backend_grpc_service
                  timeout: 0s
                  max_stream_duration:
                    grpc_timeout_header_max: 0s
              cors:
                allow_origin_string_match:
                - prefix: "*"
                allow_methods: GET, PUT, DELETE, POST, OPTIONS
                allow_headers: keep-alive,user-agent,cache-control,content-type,content-transfer-encoding,custom-header-1,x-accept-content-transfer-encoding,x-accept-response-streaming,x-user-agent,x-grpc-web,grpc-timeout
                max_age: "1728000"
                expose_headers: custom-header-1,grpc-status,grpc-message
          http_filters:
          - name: envoy.filters.http.grpc_web
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.grpc_web.v3.GrpcWeb
          - name: envoy.filters.http.cors
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.cors.v3.Cors
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router

  clusters:
  - name: backend_grpc_service
    type: LOGICAL_DNS
    lb_policy: ROUND_ROBIN
    typed_extension_protocol_options:
      envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
        "@type": type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions
        explicit_http_config:
          http2_protocol_options: {}
    load_assignment:
      cluster_name: backend_grpc_service
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend
                port_value: 50051
```

**Key Features Explained**:
- **CORS configuration for browser security**
  - Sets rules about which websites can use your API
  - The `allow_origin_string_match: prefix: "*"` means any website can access (use cautiously!)

- **HTTP/2 support for gRPC**
  - Enables the advanced features gRPC needs
  - Configured in `http2_protocol_options`

- **Access logging for debugging**
  - Records all requests/responses for troubleshooting
  - Like a security camera for your API

- **Load balancing capability**
  - Can distribute traffic across multiple backend servers
  - Like having multiple cashiers at a busy store

**What is a Proxy?**
- A middleman between client and server
- Like a translator at a international conference
- Envoy specifically translates between what browsers understand and what gRPC servers expect

### Step 5: Frontend - gRPC Client Wrapper

**File**: `frontend/src/services/grpcClient.ts`

**Purpose**: Wraps the generated gRPC-Web client with business logic, error handling, and TypeScript types.

```typescript
import { Empty } from 'google-protobuf/google/protobuf/empty_pb';
import * as grpcWeb from 'grpc-web';
import toast from 'react-hot-toast';

// Import generated protobuf classes
import {
  TaskServiceClient as GeneratedClient,
  Task,
  CreateTaskRequest,
  GetTaskRequest,
  UpdateTaskRequest,
  DeleteTaskRequest,
  ListTasksRequest,
  ListTasksResponse,
  WatchTasksRequest,
  TaskEvent,
  TaskStatus,
  Priority,
  EventType,
  BulkCreateResponse,
  TaskCommand,
  TaskResult,
} from '../generated/index';

// Export types for use in components
export { Task, TaskStatus, Priority, EventType, TaskEvent };

// Custom error class
export class GrpcError extends Error {
  code: grpcWeb.StatusCode;
  metadata?: grpcWeb.Metadata;

  constructor(code: grpcWeb.StatusCode, message: string, metadata?: grpcWeb.Metadata) {
    super(message);
    this.code = code;
    this.metadata = metadata;
    this.name = 'GrpcError';
  }
}

// Performance monitoring
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordLatency(method: string, latency: number) {
    if (!this.metrics.has(method)) {
      this.metrics.set(method, []);
    }
    this.metrics.get(method)!.push(latency);
  }

  getAverageLatency(method: string): number {
    const latencies = this.metrics.get(method) || [];
    if (latencies.length === 0) return 0;
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }
}

// Main client class
export class TaskServiceClient {
  private client: GeneratedClient;
  private metadata: grpcWeb.Metadata;
  private performanceMonitor: PerformanceMonitor;

  constructor(url: string = process.env.REACT_APP_GRPC_WEB_URL || 'http://localhost:8080') {
    this.client = new GeneratedClient(url, null, null);
    this.metadata = {
      'custom-header': 'grpc-web-client',
    };
    this.performanceMonitor = new PerformanceMonitor();
  }

  // Set authentication token
  setAuthToken(token: string) {
    this.metadata['authorization'] = `Bearer ${token}`;
  }

  // Create a new task
  async createTask(
    title: string,
    description: string,
    priority?: Priority,
    labels?: string[]
  ): Promise<Task> {
    const request = new CreateTaskRequest();
    request.setTitle(title);
    request.setDescription(description);

    if (priority !== undefined) {
      request.setPriority(priority);
    }

    if (labels && labels.length > 0) {
      request.setLabelsList(labels);
    }

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      this.client.createTask(request, this.metadata, (err, response) => {
        const latency = Date.now() - startTime;
        this.performanceMonitor.recordLatency('createTask', latency);

        if (err) {
          console.error('CreateTask error:', err);
          toast.error(`Failed to create task: ${err.message}`);
          reject(new GrpcError(err.code, err.message, err.metadata));
        } else {
          toast.success('Task created successfully!');
          resolve(response);
        }
      });
    });
  }

  // Get a single task
  async getTask(id: string): Promise<Task> {
    const request = new GetTaskRequest();
    request.setId(id);

    return new Promise((resolve, reject) => {
      this.client.getTask(request, this.metadata, (err, response) => {
        if (err) {
          console.error('GetTask error:', err);
          reject(new GrpcError(err.code, err.message, err.metadata));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Update a task
  async updateTask(
    id: string,
    updates: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: Priority;
    }
  ): Promise<Task> {
    const request = new UpdateTaskRequest();
    request.setId(id);

    if (updates.title !== undefined) {
      request.setTitle(updates.title);
    }
    if (updates.description !== undefined) {
      request.setDescription(updates.description);
    }
    if (updates.status !== undefined) {
      request.setStatus(updates.status);
    }
    if (updates.priority !== undefined) {
      request.setPriority(updates.priority);
    }

    return new Promise((resolve, reject) => {
      this.client.updateTask(request, this.metadata, (err, response) => {
        if (err) {
          console.error('UpdateTask error:', err);
          toast.error(`Failed to update task: ${err.message}`);
          reject(new GrpcError(err.code, err.message, err.metadata));
        } else {
          toast.success('Task updated successfully!');
          resolve(response);
        }
      });
    });
  }

  // Delete a task
  async deleteTask(id: string): Promise<void> {
    const request = new DeleteTaskRequest();
    request.setId(id);

    return new Promise((resolve, reject) => {
      this.client.deleteTask(request, this.metadata, (err, response) => {
        if (err) {
          console.error('DeleteTask error:', err);
          toast.error(`Failed to delete task: ${err.message}`);
          reject(new GrpcError(err.code, err.message, err.metadata));
        } else {
          toast.success('Task deleted successfully!');
          resolve();
        }
      });
    });
  }

  // List tasks with pagination
  async listTasks(
    filter?: string,
    pageSize?: number,
    pageToken?: string
  ): Promise<ListTasksResponse> {
    const request = new ListTasksRequest();

    if (filter) {
      request.setFilter(filter);
    }
    if (pageSize) {
      request.setPageSize(pageSize);
    }
    if (pageToken) {
      request.setPageToken(pageToken);
    }

    return new Promise((resolve, reject) => {
      this.client.listTasks(request, this.metadata, (err, response) => {
        if (err) {
          console.error('ListTasks error:', err);
          toast.error(`Failed to load tasks: ${err.message}`);
          reject(new GrpcError(err.code, err.message, err.metadata));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Watch tasks for real-time updates
  watchTasks(
    onEvent: (event: TaskEvent) => void,
    filter?: string
  ): grpcWeb.ClientReadableStream<TaskEvent> {
    const request = new WatchTasksRequest();

    if (filter) {
      request.setFilter(filter);
    }

    const stream = this.client.watchTasks(request, this.metadata);

    stream.on('data', (event: TaskEvent) => {
      console.log('Received event:', event.toObject());
      onEvent(event);
    });

    stream.on('end', () => {
      console.log('Stream ended');
      toast('Connection to server closed');
    });

    stream.on('error', (err) => {
      console.error('Stream error:', err);
      toast.error('Connection to server lost');
    });

    return stream;
  }

  // Get performance metrics
  getMetrics() {
    return {
      createTaskAvgLatency: this.performanceMonitor.getAverageLatency('createTask'),
    };
  }
}

// Create and export a default client instance
export const defaultClient = new TaskServiceClient();
```

**Key Features Explained**:
- **Promise-based API (converts callbacks to promises)**
  - **What are Promises?** A cleaner way to handle asynchronous operations
  - Instead of: `doSomething(data, function(result) { ... })`
  - We use: `doSomething(data).then(result => { ... })`
  - Like ordering food online - you get a promise it will arrive, then you can plan what to do when it does

- **Error handling with toast notifications**
  - **What are Toast Notifications?** Small popup messages (like phone notifications)
  - Appear briefly to inform users of success/failure
  - Named "toast" because they pop up like toast from a toaster!

- **Performance monitoring**
  - Tracks how long each operation takes
  - Like a stopwatch for your API calls
  - Helps identify slow operations

- **Authentication support**
  - **What is Authentication?** Proving who you are (like showing ID)
  - Adds security tokens to requests
  - Like a membership card that proves you're allowed to use the service

- **TypeScript type safety**
  - **What is TypeScript?** JavaScript with types
  - Catches errors before code runs
  - Like spell-check for your code - prevents typos and mistakes

### Step 6: React Components

#### Main App Component
**File**: `frontend/src/App.tsx`

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  AppBar,
  Toolbar,
  Tab,
  Tabs,
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
import { TaskServiceClient } from './services/grpcClient';
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
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  /*
   * React Hooks Explained:
   *
   * What are Hooks?
   * - Special functions that let you "hook into" React features
   * - Always start with "use" (useState, useEffect, useCallback)
   * - Like kitchen appliances - each has a specific purpose
   *
   * useState: Manages component data
   * - const [value, setValue] = useState(initialValue)
   * - Like a variable that React watches for changes
   * - When it changes, React re-renders the component
   *
   * useEffect: Runs side effects
   * - Runs code after render (like loading data)
   * - Like "when this happens, do that"
   *
   * useCallback: Memoizes functions
   * - Prevents recreating functions on every render
   * - Like saving a recipe instead of rewriting it each time
   */

  // gRPC client
  const [client] = useState(() => new TaskServiceClient());

  // Load initial tasks
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await client.listTasks();
      setTasks(response.getTasksList());
      setConnected(true);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Initialize
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Handle task creation
  const handleTaskCreated = (task: Task) => {
    setTasks(prev => [...prev, task]);
  };

  // Handle task update
  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks(prev => prev.map(task =>
      task.getId() === updatedTask.getId() ? updatedTask : task
    ));
  };

  // Handle task deletion
  const handleTaskDeleted = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.getId() !== taskId));
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            gRPC-Web Task Manager
          </Typography>
          <ConnectionStatus connected={connected} />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Paper sx={{ mb: 2 }}>
          <Tabs
            value={tabValue}
            onChange={(e, newValue) => setTabValue(newValue)}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Tasks" />
            <Tab label="Streaming Demo" />
            <Tab label="Metrics" />
          </Tabs>
        </Paper>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Create New Task
                </Typography>
                <CreateTaskForm
                  onTaskCreated={handleTaskCreated}
                  client={client}
                />
              </Paper>
            </Grid>

            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Task List
                </Typography>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <TaskList
                    tasks={tasks}
                    onTaskUpdated={handleTaskUpdated}
                    onTaskDeleted={handleTaskDeleted}
                    client={client}
                  />
                )}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <StreamingDemo client={client} />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <MetricsPanel client={client} />
        </TabPanel>
      </Container>

      <Toaster position="bottom-right" />
    </Box>
  );
}

export default App;
```

#### Create Task Form Component
**File**: `frontend/src/components/CreateTaskForm.tsx`

```typescript
import React, { useState } from 'react';
import {
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Box,
  Stack,
} from '@mui/material';
import { TaskServiceClient, Priority, Task } from '../services/grpcClient';

interface CreateTaskFormProps {
  onTaskCreated: (task: Task) => void;
  client: TaskServiceClient;
}

function CreateTaskForm({ onTaskCreated, client }: CreateTaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.PRIORITY_MEDIUM);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    setLoading(true);
    try {
      const task = await client.createTask(
        title,
        description,
        priority,
        labels
      );

      // Clear form
      setTitle('');
      setDescription('');
      setPriority(Priority.PRIORITY_MEDIUM);
      setLabels([]);

      // Notify parent
      onTaskCreated(task);
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLabel = () => {
    if (labelInput.trim() && !labels.includes(labelInput)) {
      setLabels([...labels, labelInput]);
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (label: string) => {
    setLabels(labels.filter(l => l !== label));
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          required
        />

        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={3}
        />

        <FormControl fullWidth>
          <InputLabel>Priority</InputLabel>
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            label="Priority"
          >
            <MenuItem value={Priority.PRIORITY_LOW}>Low</MenuItem>
            <MenuItem value={Priority.PRIORITY_MEDIUM}>Medium</MenuItem>
            <MenuItem value={Priority.PRIORITY_HIGH}>High</MenuItem>
            <MenuItem value={Priority.PRIORITY_CRITICAL}>Critical</MenuItem>
          </Select>
        </FormControl>

        <Box>
          <TextField
            label="Add Label"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLabel())}
            size="small"
          />
          <Button onClick={handleAddLabel} sx={{ ml: 1 }}>
            Add
          </Button>
        </Box>

        {labels.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {labels.map((label) => (
              <Chip
                key={label}
                label={label}
                onDelete={() => handleRemoveLabel(label)}
                size="small"
              />
            ))}
          </Box>
        )}

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={loading || !title.trim()}
        >
          {loading ? 'Creating...' : 'Create Task'}
        </Button>
      </Stack>
    </Box>
  );
}

export default CreateTaskForm;
```

#### Streaming Demo Component
**File**: `frontend/src/components/StreamingDemo.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Stream as StreamIcon,
} from '@mui/icons-material';
import * as grpcWeb from 'grpc-web';
import {
  TaskServiceClient,
  TaskEvent,
  EventType,
  TaskStatus,
} from '../services/grpcClient';

interface StreamingDemoProps {
  client: TaskServiceClient;
}

function StreamingDemo({ client }: StreamingDemoProps) {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [stream, setStream] = useState<grpcWeb.ClientReadableStream<TaskEvent> | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const startStream = () => {
    if (stream) return;

    const newStream = client.watchTasks((event) => {
      setEvents(prev => [...prev, event]);
    });

    setStream(newStream);
    setIsStreaming(true);
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
        return <EditIcon color="info" />;
      case EventType.EVENT_TYPE_DELETED:
        return <DeleteIcon color="error" />;
      default:
        return <StreamIcon />;
    }
  };

  const getEventColor = (eventType: EventType): "success" | "info" | "error" | "default" => {
    switch (eventType) {
      case EventType.EVENT_TYPE_CREATED:
        return "success";
      case EventType.EVENT_TYPE_UPDATED:
        return "info";
      case EventType.EVENT_TYPE_DELETED:
        return "error";
      default:
        return "default";
    }
  };

  const formatTimestamp = (timestamp: any) => {
    const date = new Date(timestamp.getSeconds() * 1000);
    return date.toLocaleTimeString();
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">
          Real-time Task Stream
        </Typography>
        <Button
          variant={isStreaming ? 'outlined' : 'contained'}
          color={isStreaming ? 'error' : 'primary'}
          onClick={isStreaming ? stopStream : startStream}
          startIcon={<StreamIcon />}
        >
          {isStreaming ? 'Stop Streaming' : 'Start Streaming'}
        </Button>
      </Box>

      {isStreaming && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Streaming is active. Create, update, or delete tasks to see real-time events.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto', bgcolor: 'background.default' }}>
        <List>
          {events.length === 0 ? (
            <ListItem>
              <ListItemText
                primary="No events yet"
                secondary="Start streaming to see real-time task events"
              />
            </ListItem>
          ) : (
            events.map((event, index) => {
              const task = event.getTask();
              const eventType = event.getEventType();

              return (
                <ListItem key={index} divider>
                  <ListItemIcon>
                    {getEventIcon(eventType)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={EventType[eventType]}
                          size="small"
                          color={getEventColor(eventType)}
                        />
                        <Typography variant="body1">
                          {task?.getTitle() || 'Unknown Task'}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" component="div">
                          ID: {task?.getId()}
                        </Typography>
                        <Typography variant="caption" component="div">
                          Status: {task ? TaskStatus[task.getStatus()] : 'Unknown'}
                        </Typography>
                        <Typography variant="caption" component="div">
                          Time: {formatTimestamp(event.getTimestamp())}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              );
            })
          )}
          <div ref={eventsEndRef} />
        </List>
      </Paper>

      {events.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            Total events: {events.length}
          </Typography>
          <Button
            size="small"
            onClick={() => setEvents([])}
            disabled={isStreaming}
          >
            Clear Events
          </Button>
        </Box>
      )}
    </Paper>
  );
}

export default StreamingDemo;
```

### Step 7: Docker Configuration

#### Backend Dockerfile
**File**: `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy proto files
COPY proto /app/proto

# Generate Python protobuf files
RUN mkdir -p /app/generated && \
    python -m grpc_tools.protoc \
    -I/app/proto \
    --python_out=/app/generated \
    --grpc_python_out=/app/generated \
    /app/proto/task_service.proto

# Copy application code
COPY backend/ .

# Expose gRPC port
EXPOSE 50051

# Set Python path to include generated files
ENV PYTHONPATH=/app:/app/generated

# Run the server
CMD ["python", "server.py"]
```

#### Frontend Dockerfile
**File**: `frontend/Dockerfile`

```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install protobuf compiler and tools
RUN apk add --no-cache protobuf protobuf-dev

# Copy package files
COPY frontend/package.json ./
RUN npm install --legacy-peer-deps

# Install global dependencies for protobuf generation
RUN npm install -g protoc-gen-grpc-web protoc-gen-js

# Copy the rest of the application
COPY frontend/ .

# Expose port
EXPOSE 3000

# Start the development server
CMD ["npm", "start"]
```

#### Docker Compose
**File**: `docker-compose.yml`

```yaml
version: '3.8'

networks:
  grpc-network:
    driver: bridge

services:
  # Python gRPC Backend
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    container_name: grpc-backend
    ports:
      - "50051:50051"
    environment:
      - PYTHONUNBUFFERED=1
      - GRPC_VERBOSITY=DEBUG
      - GRPC_TRACE=all
    volumes:
      - ./backend:/app
      - ./proto:/app/proto
      - ./backend/generated:/app/generated
    networks:
      - grpc-network
    healthcheck:
      test: ["CMD", "python", "-c", "import grpc; grpc.channel_ready_future(grpc.insecure_channel('localhost:50051')).result(timeout=5)"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Envoy Proxy
  envoy:
    image: envoyproxy/envoy:v1.28-latest
    container_name: grpc-envoy
    ports:
      - "8080:8080"
      - "9901:9901"
    volumes:
      - ./envoy/envoy.yaml:/etc/envoy/envoy.yaml
    networks:
      - grpc-network
    depends_on:
      - backend
    command: /usr/local/bin/envoy -c /etc/envoy/envoy.yaml

  # React Frontend
  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    container_name: grpc-frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_GRPC_WEB_URL=http://localhost:8080
      - CHOKIDAR_USEPOLLING=true
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
      - ./frontend/generated:/app/src/generated
    networks:
      - grpc-network
    depends_on:
      - envoy

  # Protobuf Code Generator
  protogen:
    build:
      context: .
      dockerfile: Dockerfile.protogen
    container_name: grpc-protogen
    volumes:
      - ./proto:/proto
      - ./backend/generated:/backend/generated
      - ./frontend/src/generated:/frontend/generated
      - ./scripts:/scripts
    command: echo "Protogen container ready. Run 'docker-compose run --rm protogen /scripts/generate_all_protos.sh' to generate code."
```

## Data Flow Explanation

### 1. Task Creation Flow

```
User Action → React Component → gRPC-Web Client → Envoy Proxy → gRPC Server → Database
     ↓              ↓                   ↓              ↓            ↓           ↓
  Click      CreateTaskForm     grpcClient.ts    HTTP/1.1      HTTP/2     In-Memory
 "Create"     handleSubmit()     createTask()    gRPC-Web       gRPC       Storage
                                                                   ↓
                                                            Broadcast Event
                                                                   ↓
                                                            All Watchers
```

### 2. Real-time Streaming Flow

```
gRPC Server → Event Queue → Server Stream → Envoy → Client Stream → React State
     ↓             ↓             ↓           ↓            ↓              ↓
Task Change   Queue.put()   WatchTasks    Translate   onData()     setEvents()
                              yield       HTTP/2→1.1   callback
```

### 3. Error Handling Flow

```
Server Error → gRPC Status → Envoy → Client Error → Toast Notification
      ↓            ↓           ↓          ↓               ↓
   Exception   StatusCode    Forward   GrpcError    toast.error()
              NOT_FOUND                 Handler
```

## Why This Architecture

### 1. **Protocol Buffers**
- **Type Safety**: Strong typing across all languages
  - **What is Type Safety?** The computer knows exactly what kind of data to expect
  - Like labeled containers - you can't accidentally put soup in a cereal box
  - Prevents bugs like trying to add a number to a word

- **Performance**: Binary format, smaller than JSON
  - Binary is more compact - like zip files vs regular files
  - Faster to send over network and parse

- **Code Generation**: No manual parsing/serialization
  - **What is Serialization?** Converting data to a format for transmission
  - Like packing a suitcase (serialize) and unpacking at destination (deserialize)
  - Proto automatically creates the packing/unpacking code for you

- **Schema Evolution**: Backward/forward compatibility
  - **What is Schema?** The structure/blueprint of your data
  - Can add new fields without breaking old clients
  - Like adding new fields to a form - old forms still work

### 2. **gRPC**
- **HTTP/2**: Multiplexing, server push, header compression
  - We already explained these concepts above!
  - Multiple requests at once, server can send without being asked, smaller headers

- **Streaming**: Bidirectional real-time communication
  - Like a video call vs sending video messages
  - Data flows continuously in both directions

- **Code Generation**: Client/server stubs auto-generated
  - **What are Stubs?** Pre-written code that handles communication
  - Like having a personal assistant who knows how to make all the calls for you

- **Cross-Language**: Works with many programming languages
  - Write proto once, use in Python, JavaScript, Go, Java, etc.
  - Like a universal adapter for programming languages

### 3. **Envoy Proxy**
- **Browser Compatibility**: Translates gRPC-Web ↔ gRPC
  - Makes it possible for browsers to talk to gRPC servers
  - Acts as the interpreter between two different protocols

- **Load Balancing**: Distribute traffic across backends
  - **What is Load Balancing?** Spreading work across multiple servers
  - Like having multiple checkout lines at a store - faster service

- **Observability**: Metrics, tracing, access logs
  - **What is Observability?** Ability to see what's happening inside your system
  - Like having cameras and sensors in a factory

- **Security**: TLS termination, rate limiting
  - **TLS**: Encryption for data in transit (like sealed envelopes)
  - **Rate Limiting**: Prevents abuse by limiting requests per user
  - Like a bouncer who ensures no one takes too much

### 4. **Docker & Docker Compose**
- **Consistency**: Same environment everywhere
  - **What is Docker?** Containers that package your app with everything it needs
  - Like shipping containers - same container works on any ship/truck/train
  - Solves "it works on my machine" problem

- **Isolation**: Services don't interfere
  - Each service runs in its own container
  - Like apartments in a building - neighbors can't mess up your space

- **Scalability**: Easy to add more instances
  - Can run multiple copies of any service
  - Like adding more cashiers when the store is busy

- **Development**: Hot reloading, volume mounts
  - **Hot Reloading**: See changes instantly without restarting
  - **Volume Mounts**: Your local files appear inside the container
  - Like having a magic mirror that reflects changes immediately

### 5. **React + TypeScript**
- **Type Safety**: Catch errors at compile time
  - **Compile Time**: When code is being prepared to run
  - Find mistakes before users see them

- **Component Reuse**: Modular architecture
  - **Components**: Reusable pieces of UI (like LEGO blocks)
  - Build once, use many times

- **State Management**: Efficient updates
  - **State**: The current data/status of your app
  - Only updates parts that changed (not the whole page)

- **Developer Experience**: IntelliSense, refactoring
  - **IntelliSense**: Auto-completion and hints while coding
  - **Refactoring**: Safely renaming/reorganizing code
  - Like having a smart assistant that suggests what to type next

## Production Considerations

### 1. **Security**
- **Use TLS for all connections**
  - **What is TLS?** Transport Layer Security - encrypts data in transit
  - Like sending letters in locked boxes instead of postcards
  - Prevents eavesdropping on sensitive data
  - HTTPS = HTTP + TLS

- **Implement proper authentication (JWT, OAuth)**
  - **JWT (JSON Web Tokens)**: Digital ID cards that expire
    - Contains user info and permissions
    - Self-contained - no need to check database every time
  - **OAuth**: Letting users log in with Google/Facebook/etc
    - Like using your driver's license to enter multiple buildings
    - User doesn't share password with your app

- **Rate limiting at proxy level**
  - Prevents one user from overwhelming your service
  - Like limiting each customer to 10 items in express checkout
  - Protects against DDoS attacks and abusive clients

- **Input validation on both client and server**
  - **Client validation**: Quick feedback, better UX
  - **Server validation**: Real security (never trust the client!)
  - Like checking ID at both the door and the bar
  - Prevents SQL injection, XSS, and other attacks

### 2. **Scalability**
- **Use a real database (PostgreSQL, MongoDB)**
  - **PostgreSQL**: Traditional relational database (tables with rows/columns)
    - Like Excel spreadsheets with relationships
    - Good for structured data with complex queries
  - **MongoDB**: NoSQL document database
    - Stores data as JSON-like documents
    - Like filing cabinets with flexible folders
    - Good for varied data structures

- **Implement caching (Redis)**
  - **What is Caching?** Storing frequently used data for quick access
  - **Redis**: Super-fast in-memory data store
  - Like keeping snacks in your desk drawer instead of going to the kitchen
  - Reduces database load and improves response times

- **Load balance backend instances**
  - Run multiple copies of your server
  - Distribute incoming requests among them
  - Like having multiple cashiers at a busy store
  - If one server fails, others keep working

- **Use Kubernetes for orchestration**
  - **What is Kubernetes (K8s)?** Container management system
  - Automatically manages your Docker containers
  - Like a smart building manager that:
    - Starts new apartments (containers) when needed
    - Fixes broken ones automatically
    - Distributes residents (traffic) evenly
    - Scales up during busy times

### 3. **Monitoring**
- **Prometheus metrics from Envoy**
  - **What is Prometheus?** Time-series database for metrics
  - Collects numbers over time (requests per second, response times, etc.)
  - Like a fitness tracker for your application
  - Creates graphs showing system health

- **Distributed tracing (Jaeger)**
  - **What is Distributed Tracing?** Following a request through multiple services
  - Like tracking a package through FedEx - see every stop it makes
  - **Jaeger**: Tool that visualizes these traces
  - Helps find bottlenecks in complex systems

- **Centralized logging (ELK stack)**
  - **ELK = Elasticsearch, Logstash, Kibana**
  - **Elasticsearch**: Searches through logs super fast
  - **Logstash**: Collects logs from all services
  - **Kibana**: Visualizes logs with pretty dashboards
  - Like having all security camera footage in one place

- **Error tracking (Sentry)**
  - Automatically catches and reports errors
  - Groups similar errors together
  - Like having a smart assistant that tells you when things break
  - Shows exactly where in code the error happened

### 4. **Performance**
- **Connection pooling**
  - **What is a Connection Pool?** Pre-made connections ready to use
  - Like having taxis waiting at a taxi stand instead of calling one each time
  - Avoids the overhead of creating new connections
  - Reuses existing connections = faster responses

- **Request batching**
  - **What is Batching?** Combining multiple requests into one
  - Like carpooling instead of everyone driving separately
  - Example: Instead of 10 separate "update task" calls, send one call with 10 updates
  - Reduces network overhead and improves efficiency

- **Pagination for large datasets**
  - Already explained above - breaking data into pages
  - Prevents loading thousands of items at once
  - Better performance and user experience

- **Compression (gzip)**
  - **What is gzip?** A way to compress data before sending
  - Like vacuum-packing clothes to fit more in a suitcase
  - Reduces data size by 70-90% for text
  - Faster downloads, less bandwidth usage

## Conclusion

This architecture provides:
- **Type-safe** communication between frontend and backend
- **Real-time** updates via streaming
- **Scalable** microservices architecture
- **Developer-friendly** with hot reloading and code generation
- **Production-ready** with proper error handling and monitoring

The combination of gRPC, Protocol Buffers, and modern web technologies creates a robust foundation for building high-performance web applications with real-time features.