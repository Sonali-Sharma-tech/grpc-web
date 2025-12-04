#!/usr/bin/env python3
"""
Test script for gRPC-Web Demo
Tests all RPC patterns and verifies the setup is working correctly
"""

import sys
import time
import grpc
import asyncio
from concurrent import futures

# Add generated files to path
sys.path.append('../backend/generated')

from task_service_pb2 import (
    CreateTaskRequest,
    GetTaskRequest,
    ListTasksRequest,
    UpdateTaskRequest,
    DeleteTaskRequest,
    WatchTasksRequest,
    Priority,
    TaskStatus,
)
from task_service_pb2_grpc import TaskServiceStub


class GrpcTester:
    """Test client for gRPC services"""

    def __init__(self, host='localhost', port=50051):
        self.channel = grpc.insecure_channel(f'{host}:{port}')
        self.stub = TaskServiceStub(self.channel)
        self.created_task_ids = []

    def test_create_task(self):
        """Test unary RPC: Create Task"""
        print("\n=== Testing Create Task (Unary RPC) ===")

        request = CreateTaskRequest(
            title="Test Task from Script",
            description="This task was created by the test script",
            priority=Priority.PRIORITY_HIGH,
            labels=["test", "automated"],
        )

        try:
            response = self.stub.CreateTask(request)
            print(f"✓ Task created successfully!")
            print(f"  ID: {response.id}")
            print(f"  Title: {response.title}")
            print(f"  Status: {TaskStatus.Name(response.status)}")
            self.created_task_ids.append(response.id)
            return response.id
        except grpc.RpcError as e:
            print(f"✗ Error creating task: {e.code()} - {e.details()}")
            return None

    def test_get_task(self, task_id):
        """Test unary RPC: Get Task"""
        print("\n=== Testing Get Task (Unary RPC) ===")

        request = GetTaskRequest(id=task_id)

        try:
            response = self.stub.GetTask(request)
            print(f"✓ Task retrieved successfully!")
            print(f"  Title: {response.title}")
            print(f"  Created by: {response.created_by}")
            return True
        except grpc.RpcError as e:
            print(f"✗ Error getting task: {e.code()} - {e.details()}")
            return False

    def test_list_tasks(self):
        """Test unary RPC: List Tasks"""
        print("\n=== Testing List Tasks (Unary RPC) ===")

        request = ListTasksRequest(
            page_size=10,
            priorities=[Priority.PRIORITY_HIGH],
        )

        try:
            response = self.stub.ListTasks(request)
            print(f"✓ Tasks listed successfully!")
            print(f"  Total count: {response.total_count}")
            print(f"  Retrieved: {len(response.tasks)} tasks")
            for task in response.tasks[:3]:  # Show first 3
                print(f"  - {task.title} [{TaskStatus.Name(task.status)}]")
            return True
        except grpc.RpcError as e:
            print(f"✗ Error listing tasks: {e.code()} - {e.details()}")
            return False

    def test_update_task(self, task_id):
        """Test unary RPC: Update Task"""
        print("\n=== Testing Update Task (Unary RPC) ===")

        request = UpdateTaskRequest(
            id=task_id,
            status=TaskStatus.TASK_STATUS_IN_PROGRESS,
            title="Updated Test Task",
        )

        try:
            response = self.stub.UpdateTask(request)
            print(f"✓ Task updated successfully!")
            print(f"  New status: {TaskStatus.Name(response.status)}")
            print(f"  New title: {response.title}")
            return True
        except grpc.RpcError as e:
            print(f"✗ Error updating task: {e.code()} - {e.details()}")
            return False

    def test_watch_tasks(self, duration=5):
        """Test server streaming RPC: Watch Tasks"""
        print("\n=== Testing Watch Tasks (Server Streaming RPC) ===")
        print(f"Watching for {duration} seconds...")

        request = WatchTasksRequest(
            include_initial=True,
            statuses=[TaskStatus.TASK_STATUS_TODO, TaskStatus.TASK_STATUS_IN_PROGRESS],
        )

        try:
            events_received = 0
            start_time = time.time()

            # Start streaming
            stream = self.stub.WatchTasks(request)

            # Set timeout for the stream
            for event in stream:
                events_received += 1
                print(f"  Event: {event.event_type} - {event.task.title}")

                # Stop after duration
                if time.time() - start_time > duration:
                    stream.cancel()
                    break

            print(f"✓ Streaming completed!")
            print(f"  Events received: {events_received}")
            return True

        except grpc.RpcError as e:
            print(f"✗ Error watching tasks: {e.code()} - {e.details()}")
            return False

    def test_bulk_create(self):
        """Test client streaming RPC: Bulk Create Tasks"""
        print("\n=== Testing Bulk Create (Client Streaming RPC) ===")

        def generate_tasks():
            for i in range(5):
                yield CreateTaskRequest(
                    title=f"Bulk Task {i+1}",
                    description=f"This is bulk task number {i+1}",
                    priority=Priority.PRIORITY_MEDIUM,
                    labels=["bulk", "test"],
                )
                time.sleep(0.1)  # Simulate streaming

        try:
            response = self.stub.BulkCreateTasks(generate_tasks())
            print(f"✓ Bulk creation completed!")
            print(f"  Success count: {response.success_count}")
            print(f"  Errors: {len(response.errors)}")
            for task in response.tasks:
                self.created_task_ids.append(task.id)
            return True
        except grpc.RpcError as e:
            print(f"✗ Error in bulk create: {e.code()} - {e.details()}")
            return False

    def test_delete_task(self, task_id):
        """Test unary RPC: Delete Task"""
        print("\n=== Testing Delete Task (Unary RPC) ===")

        request = DeleteTaskRequest(id=task_id)

        try:
            self.stub.DeleteTask(request)
            print(f"✓ Task deleted successfully!")
            return True
        except grpc.RpcError as e:
            print(f"✗ Error deleting task: {e.code()} - {e.details()}")
            return False

    def cleanup(self):
        """Clean up created tasks"""
        print("\n=== Cleanup ===")
        for task_id in self.created_task_ids:
            try:
                self.stub.DeleteTask(DeleteTaskRequest(id=task_id))
                print(f"  Deleted task: {task_id}")
            except:
                pass

    def run_all_tests(self):
        """Run all tests"""
        print("Starting gRPC-Web Demo Tests")
        print("=" * 50)

        results = {
            "Create Task": False,
            "Get Task": False,
            "List Tasks": False,
            "Update Task": False,
            "Watch Tasks": False,
            "Bulk Create": False,
            "Delete Task": False,
        }

        # Test create task
        task_id = self.test_create_task()
        results["Create Task"] = task_id is not None

        if task_id:
            # Test get task
            results["Get Task"] = self.test_get_task(task_id)

            # Test update task
            results["Update Task"] = self.test_update_task(task_id)

        # Test list tasks
        results["List Tasks"] = self.test_list_tasks()

        # Test watch tasks
        results["Watch Tasks"] = self.test_watch_tasks(duration=3)

        # Test bulk create
        results["Bulk Create"] = self.test_bulk_create()

        # Test delete task
        if task_id:
            results["Delete Task"] = self.test_delete_task(task_id)

        # Cleanup
        self.cleanup()

        # Summary
        print("\n" + "=" * 50)
        print("TEST SUMMARY")
        print("=" * 50)
        passed = sum(1 for v in results.values() if v)
        total = len(results)

        for test, result in results.items():
            status = "✓ PASS" if result else "✗ FAIL"
            print(f"{test:.<30} {status}")

        print(f"\nTotal: {passed}/{total} tests passed")

        return passed == total


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Test gRPC-Web Demo')
    parser.add_argument('--host', default='localhost', help='gRPC server host')
    parser.add_argument('--port', default=50051, type=int, help='gRPC server port')

    args = parser.parse_args()

    print(f"Connecting to gRPC server at {args.host}:{args.port}")

    try:
        tester = GrpcTester(args.host, args.port)
        success = tester.run_all_tests()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\nError: {e}")
        print("\nMake sure the gRPC server is running:")
        print("  ./scripts/start_all.sh")
        sys.exit(1)


if __name__ == '__main__':
    main()