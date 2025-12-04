// TypeScript declarations for generated protobuf types

// Re-export all types from task_service_pb
export {
  Task,
  CreateTaskRequest,
  GetTaskRequest,
  UpdateTaskRequest,
  DeleteTaskRequest,
  ListTasksRequest,
  ListTasksResponse,
  WatchTasksRequest,
  TaskEvent,
  BulkCreateResponse,
  TaskCommand,
  TaskResult,
  BulkError,
  TaskStatus,
  Priority,
  EventType
} from './task_service_pb';

// Re-export service client
export { TaskServiceClient } from './task_service_grpc_web_pb';