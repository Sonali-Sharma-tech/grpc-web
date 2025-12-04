/* eslint-disable */
// Re-export all the generated protobuf types with proper names
require('./task_service_pb.js'); // This populates the global proto object
const grpcWeb = require('./task_service_grpc_web_pb.js');

// In browser/webpack environment, proto may be attached to window or global
const globalObj = (typeof window !== 'undefined' && window) ||
                 (typeof global !== 'undefined' && global) ||
                 (typeof self !== 'undefined' && self) ||
                 {};

// The proto object should now be available
const proto = globalObj.proto || {};

// Export all types from the proto.taskservice namespace
module.exports = {
  // Message types - access through proto.taskservice namespace
  Task: proto.taskservice.Task,
  CreateTaskRequest: proto.taskservice.CreateTaskRequest,
  GetTaskRequest: proto.taskservice.GetTaskRequest,
  UpdateTaskRequest: proto.taskservice.UpdateTaskRequest,
  DeleteTaskRequest: proto.taskservice.DeleteTaskRequest,
  ListTasksRequest: proto.taskservice.ListTasksRequest,
  ListTasksResponse: proto.taskservice.ListTasksResponse,
  WatchTasksRequest: proto.taskservice.WatchTasksRequest,
  TaskEvent: proto.taskservice.TaskEvent,
  BulkCreateResponse: proto.taskservice.BulkCreateResponse,
  TaskCommand: proto.taskservice.TaskCommand,
  TaskResult: proto.taskservice.TaskResult,
  BulkError: proto.taskservice.BulkError,

  // Enums
  TaskStatus: proto.taskservice.TaskStatus,
  Priority: proto.taskservice.Priority,
  EventType: proto.taskservice.EventType,

  // Service client
  TaskServiceClient: grpcWeb.TaskServiceClient
};