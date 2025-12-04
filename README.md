# gRPC-Web Demo Application

A comprehensive demonstration of gRPC-Web architecture with Python backend, React frontend, and Envoy proxy.

## 🏗️ Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   React Web     │         │   Envoy Proxy   │         │  Python gRPC    │
│   Application   │ <-----> │   (gRPC-Web)    │ <-----> │    Backend      │
│   (Browser)     │  HTTP2  │   Translation   │  gRPC   │   (Server)      │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

## 📁 Project Structure

```
grpc-web-demo/
├── proto/               # Protocol Buffer definitions
│   └── task_service.proto
├── backend/            # Python gRPC server
│   ├── server.py
│   ├── requirements.txt
│   └── generated/      # Generated Python gRPC code
├── frontend/           # React web application
│   ├── src/
│   ├── public/
│   └── package.json
├── envoy/             # Envoy proxy configuration
│   └── envoy.yaml
├── scripts/           # Helper scripts
│   ├── generate_protos.sh
│   └── start_all.sh
└── docs/             # Additional documentation
```

## 🔑 Key Concepts Explained

### 1. **gRPC (Google Remote Procedure Call)**
- High-performance, open-source RPC framework
- Uses Protocol Buffers for service definition
- Supports streaming, authentication, and load balancing
- Native HTTP/2 transport

### 2. **gRPC-Web**
- JavaScript client library for gRPC
- Enables browser-based applications to communicate with gRPC services
- Requires a proxy (like Envoy) to translate between gRPC-Web and gRPC

### 3. **Envoy Proxy**
- Modern, high-performance edge and service proxy
- Translates gRPC-Web requests (HTTP/1.1) to gRPC (HTTP/2)
- Handles CORS, load balancing, and other cross-cutting concerns

### 4. **Protocol Buffers (Protobuf)**
- Language-neutral, platform-neutral serialization mechanism
- Smaller, faster, and simpler than XML or JSON
- Strongly-typed service contracts

## 🚀 Quick Start

```bash
# 1. Generate protobuf code
./scripts/generate_protos.sh

# 2. Start all services with Docker
docker-compose up

# 3. Open browser
# Frontend: http://localhost:3000
# Envoy Admin: http://localhost:9901
```

## 📋 Features Demonstrated

1. **Task Management Service**
   - Create, Read, Update, Delete (CRUD) operations
   - Real-time updates using server streaming
   - Bidirectional streaming for bulk operations

2. **Authentication & Metadata**
   - JWT token authentication
   - Custom metadata headers
   - Request/Response interceptors

3. **Error Handling**
   - gRPC status codes
   - Custom error details
   - Client-side retry logic

4. **Performance Monitoring**
   - Request timing
   - Envoy metrics
   - Client-side performance tracking