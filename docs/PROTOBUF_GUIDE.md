# Protocol Buffer Guide

## Understanding the Task Service Proto File

### 🎯 Service Definition Overview

Our `TaskService` demonstrates four types of gRPC communication patterns:

```protobuf
service TaskService {
  // 1. Unary RPC: One request, one response
  rpc CreateTask(CreateTaskRequest) returns (Task) {}

  // 2. Server Streaming: One request, stream of responses
  rpc WatchTasks(WatchTasksRequest) returns (stream TaskEvent) {}

  // 3. Client Streaming: Stream of requests, one response
  rpc BulkCreateTasks(stream CreateTaskRequest) returns (BulkCreateResponse) {}

  // 4. Bidirectional Streaming: Stream in both directions
  rpc ProcessTaskStream(stream TaskCommand) returns (stream TaskResult) {}
}
```

### 📊 RPC Patterns Explained

#### 1. **Unary RPC** (Traditional Request-Response)
- Client sends one request, receives one response
- Similar to REST API calls
- Examples: CreateTask, GetTask, UpdateTask, DeleteTask

```
Client                    Server
  |---- Request ----->      |
  |<--- Response -----      |
```

#### 2. **Server Streaming RPC**
- Client sends one request, receives stream of responses
- Use case: Real-time updates, watching for changes
- Example: WatchTasks for live task updates

```
Client                    Server
  |---- Request ----->      |
  |<--- Response 1 ---      |
  |<--- Response 2 ---      |
  |<--- Response N ---      |
```

#### 3. **Client Streaming RPC**
- Client sends stream of requests, receives one response
- Use case: Bulk operations, file uploads
- Example: BulkCreateTasks for creating multiple tasks

```
Client                    Server
  |---- Request 1 ---->     |
  |---- Request 2 ---->     |
  |---- Request N ---->     |
  |<--- Response ------     |
```

#### 4. **Bidirectional Streaming RPC**
- Both client and server send streams
- Use case: Chat, interactive operations
- Example: ProcessTaskStream for interactive task processing

```
Client                    Server
  |---- Request 1 ---->     |
  |<--- Response 1 ----     |
  |---- Request 2 ---->     |
  |<--- Response 2 ----     |
  |        ...              |
```

### 📝 Message Types Breakdown

#### Core Data Model: `Task`
```protobuf
message Task {
  string id = 1;                             // Unique identifier
  string title = 2;                          // Required field
  string description = 3;                    // Optional detailed description
  TaskStatus status = 4;                     // Enum for status
  Priority priority = 5;                     // Enum for priority
  repeated string labels = 6;                // Array of labels
  map<string, string> metadata = 12;         // Key-value pairs
  google.protobuf.Timestamp created_at = 9;  // Using well-known types
}
```

#### Field Types Explained:
- **Scalar Types**: `string`, `int32`, `bool`
- **Enums**: `TaskStatus`, `Priority` - Predefined set of values
- **Repeated**: Arrays/Lists (e.g., `repeated string labels`)
- **Maps**: Key-value pairs (e.g., `map<string, string> metadata`)
- **Well-known Types**: `google.protobuf.Timestamp`, `Empty`
- **Optional**: Fields that may or may not be set (Proto3)

### 🔧 Advanced Features

#### 1. **Optional Fields** (Proto3)
```protobuf
message UpdateTaskRequest {
  string id = 1;
  optional string title = 2;  // Only update if provided
  optional TaskStatus status = 4;
}
```

#### 2. **Oneof Fields** (Union Types)
```protobuf
message TaskCommand {
  oneof command {
    CreateTaskRequest create = 1;
    UpdateTaskRequest update = 2;
    DeleteTaskRequest delete = 3;
  }
}
```

#### 3. **Nested Messages**
```protobuf
message BulkCreateResponse {
  repeated Task tasks = 1;
  repeated BulkError errors = 3;  // Nested message type
}
```

### 🌐 gRPC-Web Considerations

1. **Streaming Limitations**:
   - gRPC-Web only supports Unary and Server Streaming
   - Client and Bidirectional streaming require workarounds

2. **Binary Protocol**:
   - Protobuf is binary, more efficient than JSON
   - Automatically handles serialization/deserialization

3. **Type Safety**:
   - Generated code provides strong typing
   - Compile-time validation of API contracts

### 🚀 Best Practices

1. **Field Numbering**:
   - Never reuse field numbers
   - Reserve numbers for deleted fields
   - Use 1-15 for frequently used fields (1 byte encoding)

2. **Versioning**:
   - Add new fields instead of modifying existing ones
   - Mark deprecated fields with [deprecated = true]
   - Maintain backward compatibility

3. **Naming Conventions**:
   - Services: PascalCase (e.g., `TaskService`)
   - RPCs: PascalCase (e.g., `CreateTask`)
   - Messages: PascalCase (e.g., `TaskRequest`)
   - Fields: snake_case (e.g., `created_at`)
   - Enums: SCREAMING_SNAKE_CASE (e.g., `TASK_STATUS_DONE`)

4. **Performance Tips**:
   - Use streaming for large datasets
   - Implement pagination for list operations
   - Consider field masks for partial updates