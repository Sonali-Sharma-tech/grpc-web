# Backend Server Implementation Guide

## 🏗️ Architecture Overview

The Python gRPC server demonstrates a production-ready implementation with:

- **All 4 gRPC communication patterns**
- **Thread-safe in-memory storage**
- **Authentication & authorization**
- **Real-time event streaming**
- **Comprehensive error handling**
- **Monitoring & statistics**

## 🔑 Key Components

### 1. **Service Implementation**

```python
class TaskServicer(task_service_pb2_grpc.TaskServiceServicer):
    """Implements all RPC methods defined in the proto file"""
```

The servicer class inherits from the generated base class and implements each RPC method.

### 2. **Thread Safety**

```python
self.lock = threading.RLock()  # Reentrant lock for thread safety

with self.lock:
    self.tasks[task.id] = task  # Safe concurrent access
```

Since gRPC uses a thread pool, all shared state must be protected with locks.

### 3. **Authentication Pattern**

```python
def _authenticate(self, context: grpc.ServicerContext) -> Optional[str]:
    metadata = dict(context.invocation_metadata())
    auth_token = metadata.get('authorization', '')
    # Validate token and return user_id
```

Authentication is handled via metadata (HTTP headers in gRPC-Web).

## 📊 RPC Method Implementations

### Unary RPC Example: CreateTask

```python
def CreateTask(self, request, context) -> Task:
    # 1. Authenticate
    user_id = self._authenticate(context)

    # 2. Validate
    if not request.title:
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Title required")

    # 3. Process
    task = create_task_object(request)

    # 4. Store (thread-safe)
    with self.lock:
        self.tasks[task.id] = task

    # 5. Emit event
    self._emit_event(TaskEvent(type=CREATED, task=task))

    return task
```

### Server Streaming Example: WatchTasks

```python
def WatchTasks(self, request, context):
    # 1. Create event queue for this subscriber
    event_queue = asyncio.Queue()
    self.event_subscribers[id] = event_queue

    try:
        # 2. Send initial state if requested
        if request.include_initial:
            for task in filtered_tasks:
                yield TaskEvent(task=task)

        # 3. Stream events until disconnect
        while context.is_active():
            event = await event_queue.get(timeout=1.0)
            yield event
    finally:
        # 4. Cleanup on disconnect
        del self.event_subscribers[id]
```

### Client Streaming Example: BulkCreateTasks

```python
def BulkCreateTasks(self, request_iterator, context):
    created_tasks = []
    errors = []

    # Process each request from the stream
    for index, request in enumerate(request_iterator):
        try:
            task = self.create_task_logic(request)
            created_tasks.append(task)
        except Exception as e:
            errors.append(BulkError(index=index, message=str(e)))

    return BulkCreateResponse(
        tasks=created_tasks,
        errors=errors
    )
```

### Bidirectional Streaming Example: ProcessTaskStream

```python
def ProcessTaskStream(self, request_iterator, context):
    for command in request_iterator:
        result = TaskResult()

        try:
            if command.HasField('create'):
                task = self.CreateTask(command.create, context)
                result.task.CopyFrom(task)
                result.success = True
            # ... handle other commands

            yield result
        except Exception as e:
            result.error_message = str(e)
            result.success = False
            yield result
```

## 🛡️ Error Handling

### gRPC Status Codes

```python
# Client error (4xx equivalent)
context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Title is required")
context.abort(grpc.StatusCode.NOT_FOUND, "Task not found")
context.abort(grpc.StatusCode.ALREADY_EXISTS, "Task ID exists")
context.abort(grpc.StatusCode.UNAUTHENTICATED, "Auth required")
context.abort(grpc.StatusCode.PERMISSION_DENIED, "Access denied")

# Server error (5xx equivalent)
context.abort(grpc.StatusCode.INTERNAL, "Server error")
context.abort(grpc.StatusCode.UNAVAILABLE, "Service unavailable")
```

### Rich Error Details

```python
# For bulk operations, return partial success/failure
return BulkCreateResponse(
    tasks=successful_tasks,
    errors=[
        BulkError(index=0, message="Title required"),
        BulkError(index=3, message="Invalid priority")
    ]
)
```

## 🚀 Performance Optimizations

### 1. **Connection Pooling**
```python
server = grpc.aio.server(
    futures.ThreadPoolExecutor(max_workers=10)
)
```

### 2. **Message Size Limits**
```python
options=[
    ('grpc.max_send_message_length', 50 * 1024 * 1024),
    ('grpc.max_receive_message_length', 50 * 1024 * 1024),
]
```

### 3. **Keep-Alive Settings**
```python
('grpc.keepalive_time_ms', 10000),
('grpc.keepalive_timeout_ms', 5000),
('grpc.keepalive_permit_without_calls', True),
```

### 4. **Pagination**
```python
# Don't return unlimited results
page_size = request.page_size or 10
tasks = all_tasks[start:start + page_size]
```

## 📊 Monitoring & Observability

### 1. **Structured Logging**
```python
logger.info(
    "Task created",
    task_id=task.id,
    user_id=user_id,
    duration_ms=elapsed_time
)
```

### 2. **Metrics Collection**
```python
self.stats['tasks_created'] += 1
self.stats['api_calls'] += 1
self.stats['errors'] += 1
```

### 3. **Health Checks**
```python
# Implement the standard gRPC health check protocol
health_pb2_grpc.add_HealthServicer_to_server(
    health.HealthServicer(), server
)
```

## 🔐 Security Considerations

### 1. **Authentication**
- Token-based auth via metadata
- JWT validation (simplified in demo)
- Per-method auth checks

### 2. **Authorization**
- User-based access control
- Resource ownership validation
- Rate limiting (not implemented in demo)

### 3. **Input Validation**
- Required field validation
- Enum value validation
- String length limits

### 4. **Transport Security**
```python
# For production, use TLS
server.add_secure_port(
    listen_addr,
    grpc.ssl_server_credentials([(key, cert)])
)
```

## 🧪 Testing Strategies

### 1. **Unit Tests**
```python
def test_create_task():
    servicer = TaskServicer()
    request = CreateTaskRequest(title="Test")
    context = mock_context()

    task = servicer.CreateTask(request, context)

    assert task.title == "Test"
    assert task.status == TASK_STATUS_TODO
```

### 2. **Integration Tests**
```python
async def test_watch_tasks():
    # Start server
    # Create client
    # Subscribe to events
    # Create task
    # Assert event received
```

### 3. **Load Tests**
```python
# Use ghz for gRPC load testing
# ghz --proto=./proto/task_service.proto \
#     --call=taskservice.TaskService.CreateTask \
#     --data='{"title":"Load test task"}' \
#     localhost:50051
```

## 📈 Scaling Considerations

### 1. **Database Integration**
Replace in-memory storage with:
- PostgreSQL for ACID compliance
- Redis for caching
- MongoDB for flexible schemas

### 2. **Message Queue Integration**
For event streaming:
- Kafka for event sourcing
- RabbitMQ for task queues
- Redis Streams for simple pub/sub

### 3. **Service Mesh**
- Istio for advanced traffic management
- Linkerd for observability
- Consul for service discovery

### 4. **Horizontal Scaling**
- Stateless service design
- External session storage
- Load balancer configuration