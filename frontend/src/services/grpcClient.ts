/**
 * gRPC-Web Client Service
 *
 * This service demonstrates:
 * 1. Client initialization and configuration
 * 2. Unary RPC calls with error handling
 * 3. Server streaming implementation
 * 4. Metadata/header handling for authentication
 * 5. Request/response interceptors
 * 6. Performance monitoring
 */

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

/**
 * Custom error class for gRPC errors
 */
export class GrpcError extends Error {
  code: grpcWeb.StatusCode;
  metadata?: grpcWeb.Metadata;

  constructor(code: grpcWeb.StatusCode, message: string, metadata?: grpcWeb.Metadata) {
    super(message);
    this.code = code;
    this.metadata = metadata;
  }
}

/**
 * Performance metrics tracker
 */
class PerformanceTracker {
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

  getAllMetrics() {
    const result: Record<string, number> = {};
    this.metrics.forEach((latencies, method) => {
      result[`${method}_avg_ms`] = this.getAverageLatency(method);
      result[`${method}_count`] = latencies.length;
    });
    return result;
  }
}

/**
 * Enhanced gRPC-Web client with additional features
 */
export class TaskServiceClient {
  private client: GeneratedClient;
  private metadata: grpcWeb.Metadata;
  private performanceTracker: PerformanceTracker;
  private activeStreams: Set<grpcWeb.ClientReadableStream<any>> = new Set();

  constructor(
    hostname: string = 'http://localhost:8081',
    authToken?: string
  ) {
    // Initialize the generated client
    this.client = new GeneratedClient(hostname, null, null);

    // Setup default metadata (headers)
    this.metadata = {
      'authorization': authToken || 'Bearer anonymous-user',
      'x-client-version': '1.0.0',
      'ngrok-skip-browser-warning': 'true',  // Skip ngrok interstitial page
    };

    this.performanceTracker = new PerformanceTracker();
  }

  /**
   * Test connection to the server
   */
  async checkConnection(): Promise<boolean> {
    try {
      const request = new ListTasksRequest();
      request.setPageSize(1);
      await this.makeUnaryCall('listTasks', request);
      return true;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  }

  /**
   * Generic unary call wrapper with error handling and metrics
   */
  private async makeUnaryCall<TRequest, TResponse>(
    methodName: string,
    request: TRequest
  ): Promise<TResponse> {
    const startTime = performance.now();

    try {
      // @ts-ignore - Dynamic method call
      const response = await new Promise<TResponse>((resolve, reject) => {
        // @ts-ignore
        this.client[methodName](
          request,
          this.metadata,
          (err: grpcWeb.RpcError | null, response: TResponse) => {
            if (err) {
              reject(new GrpcError(err.code, err.message, err.metadata));
            } else {
              resolve(response);
            }
          }
        );
      });

      // Record success metrics
      const latency = performance.now() - startTime;
      this.performanceTracker.recordLatency(methodName, latency);

      return response;
    } catch (error) {
      // Record error metrics
      const latency = performance.now() - startTime;
      this.performanceTracker.recordLatency(methodName, latency);

      // Handle specific error codes
      if (error instanceof GrpcError) {
        switch (error.code) {
          case grpcWeb.StatusCode.UNAUTHENTICATED:
            toast.error('Authentication required. Please log in.');
            break;
          case grpcWeb.StatusCode.PERMISSION_DENIED:
            toast.error('Permission denied for this operation.');
            break;
          case grpcWeb.StatusCode.NOT_FOUND:
            toast.error('Resource not found.');
            break;
          case grpcWeb.StatusCode.ALREADY_EXISTS:
            toast.error('Resource already exists.');
            break;
          case grpcWeb.StatusCode.INVALID_ARGUMENT:
            toast.error(`Invalid input: ${error.message}`);
            break;
          default:
            toast.error(`Error: ${error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Create a new task (Unary RPC)
   */
  async createTask(
    title: string,
    description: string,
    priority: Priority = Priority.PRIORITY_MEDIUM,
    labels: string[] = []
  ): Promise<Task> {
    const request = new CreateTaskRequest();
    request.setTitle(title);
    request.setDescription(description);
    request.setPriority(priority);
    request.setLabelsList(labels);

    const response = await this.makeUnaryCall<CreateTaskRequest, Task>(
      'createTask',
      request
    );

    toast.success('Task created successfully!');
    return response;
  }

  /**
   * Get a task by ID (Unary RPC)
   */
  async getTask(taskId: string): Promise<Task> {
    const request = new GetTaskRequest();
    request.setId(taskId);

    return this.makeUnaryCall<GetTaskRequest, Task>('getTask', request);
  }

  /**
   * Update a task (Unary RPC)
   */
  async updateTask(
    taskId: string,
    updates: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: Priority;
      labels?: string[];
    }
  ): Promise<Task> {
    const request = new UpdateTaskRequest();
    request.setId(taskId);

    // Only set fields that are provided
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
    if (updates.labels !== undefined) {
      request.setLabelsList(updates.labels);
    }

    const response = await this.makeUnaryCall<UpdateTaskRequest, Task>(
      'updateTask',
      request
    );

    toast.success('Task updated successfully!');
    return response;
  }

  /**
   * Delete a task (Unary RPC)
   */
  async deleteTask(taskId: string): Promise<void> {
    const request = new DeleteTaskRequest();
    request.setId(taskId);

    await this.makeUnaryCall<DeleteTaskRequest, Empty>('deleteTask', request);
    toast.success('Task deleted successfully!');
  }

  /**
   * List tasks with optional filters (Unary RPC)
   */
  async listTasks(options: {
    pageSize?: number;
    pageToken?: string;
    statuses?: TaskStatus[];
    priorities?: Priority[];
    labels?: string[];
  } = {}): Promise<Task[]> {
    const request = new ListTasksRequest();

    if (options.pageSize) {
      request.setPageSize(options.pageSize);
    }
    if (options.pageToken) {
      request.setPageToken(options.pageToken);
    }
    if (options.statuses) {
      request.setStatusesList(options.statuses);
    }
    if (options.priorities) {
      request.setPrioritiesList(options.priorities);
    }
    if (options.labels) {
      request.setLabelsList(options.labels);
    }

    const response = await this.makeUnaryCall<ListTasksRequest, ListTasksResponse>(
      'listTasks',
      request
    );

    return response.getTasksList();
  }

  /**
   * Watch for task updates (Server Streaming RPC)
   */
  watchTasks(
    onEvent: (event: TaskEvent) => void,
    options: {
      taskIds?: string[];
      statuses?: TaskStatus[];
      labels?: string[];
      includeInitial?: boolean;
    } = {}
  ): grpcWeb.ClientReadableStream<TaskEvent> {
    const request = new WatchTasksRequest();

    if (options.taskIds) {
      request.setTaskIdsList(options.taskIds);
    }
    if (options.statuses) {
      request.setStatusesList(options.statuses);
    }
    if (options.labels) {
      request.setLabelsList(options.labels);
    }
    if (options.includeInitial !== undefined) {
      request.setIncludeInitial(options.includeInitial);
    }

    // Create the stream
    const stream = this.client.watchTasks(request, this.metadata);

    // Track active stream
    this.activeStreams.add(stream);

    // Handle stream events
    stream.on('data', (event: TaskEvent) => {
      console.log('Task event received:', {
        type: EventType[event.getEventType()],
        taskId: event.getTask()?.getId(),
      });
      onEvent(event);
    });

    stream.on('error', (err: grpcWeb.RpcError) => {
      console.error('Stream error:', err);
      toast.error(`Stream error: ${err.message}`);
      this.activeStreams.delete(stream);
    });

    stream.on('end', () => {
      console.log('Stream ended');
      this.activeStreams.delete(stream);
    });

    return stream;
  }

  /**
   * Bulk create tasks (Client Streaming - simulated with unary call)
   * Note: gRPC-Web doesn't support client streaming, so we simulate it
   */
  async bulkCreateTasks(
    taskRequests: Array<{
      title: string;
      description: string;
      priority?: Priority;
      labels?: string[];
    }>
  ): Promise<BulkCreateResponse> {
    // In a real implementation, this would be a client streaming call
    // For gRPC-Web, we need to batch the requests

    toast('Bulk creating tasks...');

    // Create tasks sequentially (in real client streaming, these would stream)
    const results: Task[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < taskRequests.length; i++) {
      try {
        const task = await this.createTask(
          taskRequests[i].title,
          taskRequests[i].description,
          taskRequests[i].priority,
          taskRequests[i].labels
        );
        results.push(task);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Create response
    const response = new BulkCreateResponse();
    response.setTasksList(results);
    response.setSuccessCount(results.length);

    if (errors.length > 0) {
      toast.error(`Failed to create ${errors.length} tasks`);
    } else {
      toast.success(`Successfully created ${results.length} tasks!`);
    }

    return response;
  }

  /**
   * Process task stream (Bidirectional Streaming - simulated)
   * Note: gRPC-Web doesn't support bidirectional streaming
   */
  async processTaskStream(
    commands: TaskCommand[],
    onResult: (result: TaskResult) => void
  ): Promise<void> {
    // Simulate bidirectional streaming with sequential processing
    for (const command of commands) {
      const result = new TaskResult();

      try {
        if (command.hasCreate()) {
          const task = await this.createTask(
            command.getCreate()!.getTitle(),
            command.getCreate()!.getDescription()
          );
          result.setSuccess(true);
          result.setTask(task);
        } else if (command.hasUpdate()) {
          const updateReq = command.getUpdate()!;
          const task = await this.updateTask(updateReq.getId(), {
            title: updateReq.hasTitle() ? updateReq.getTitle() : undefined,
            status: updateReq.hasStatus() ? updateReq.getStatus() : undefined,
          });
          result.setSuccess(true);
          result.setTask(task);
        } else if (command.hasDelete()) {
          await this.deleteTask(command.getDelete()!.getId());
          result.setSuccess(true);
        }
      } catch (error) {
        result.setSuccess(false);
        result.setErrorMessage(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      onResult(result);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.performanceTracker.getAllMetrics(),
      activeStreams: this.activeStreams.size,
    };
  }

  /**
   * Update authentication token
   */
  setAuthToken(token: string) {
    this.metadata['authorization'] = `Bearer ${token}`;
  }

  /**
   * Close all active streams and cleanup
   */
  close() {
    this.activeStreams.forEach(stream => {
      stream.cancel();
    });
    this.activeStreams.clear();
  }
}

// Get the gRPC-Web endpoint from environment variable or use default
const GRPC_WEB_URL = process.env.REACT_APP_GRPC_WEB_URL || 'http://localhost:8081';

// Export a default instance using the public endpoint
export const defaultClient = new TaskServiceClient(GRPC_WEB_URL);