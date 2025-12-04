# How the gRPC-Web Application Builds and Runs: Complete Under-the-Hood Guide

## Table of Contents
1. [Build Process: Step-by-Step](#build-process-step-by-step)
2. [Runtime Process: What Happens When You Run](#runtime-process-what-happens-when-you-run)
3. [Under the Hood: Deep Dive](#under-the-hood-deep-dive)
4. [gRPC with Vite/Webpack](#grpc-with-vitewebpack)
5. [Public Endpoints Considerations](#public-endpoints-considerations)

## Build Process: Step-by-Step

### Phase 1: Protocol Buffer Compilation

#### Step 1: Proto File Definition
```protobuf
// proto/task_service.proto
service TaskService {
    rpc CreateTask(CreateTaskRequest) returns (Task);
}
```

**What happens under the hood:**
1. **Parser reads the .proto file**
   - Lexical analysis: Breaks text into tokens
   - Syntactic analysis: Builds Abstract Syntax Tree (AST)
   - Semantic analysis: Validates types and references

2. **Code Generator creates language-specific files**
   ```
   protoc (Protocol Compiler)
      ↓
   Reads task_service.proto
      ↓
   Parses into AST
      ↓
   Applies language-specific plugin
      ↓
   Generates code files
   ```

#### Step 2: Backend Code Generation (Python)
```bash
python -m grpc_tools.protoc \
    -I/proto \
    --python_out=/backend/generated \
    --grpc_python_out=/backend/generated \
    /proto/task_service.proto
```

**Under the hood process:**
```
1. grpc_tools.protoc starts
   ↓
2. Loads Python plugin (--python_out)
   ↓
3. For each message in proto:
   - Creates Python class
   - Adds serialization methods
   - Adds field descriptors
   ↓
4. Loads gRPC Python plugin (--grpc_python_out)
   ↓
5. For each service:
   - Creates Stub class (client)
   - Creates Servicer class (server)
   - Adds method signatures
```

**Generated files:**
```python
# task_service_pb2.py (Data structures)
class Task:
    def __init__(self):
        self._id = ""
        self._title = ""

    def SerializeToString(self):
        # Converts to binary protobuf format
        # Uses variable-length encoding (varint)
        # Field 1: id (string) = tag(0x0A) + length + data
        # Field 2: title (string) = tag(0x12) + length + data

# task_service_pb2_grpc.py (Service code)
class TaskServiceStub:
    def __init__(self, channel):
        self.CreateTask = channel.unary_unary(
            '/taskservice.TaskService/CreateTask',
            request_serializer=CreateTaskRequest.SerializeToString,
            response_deserializer=Task.FromString,
        )
```

#### Step 3: Frontend Code Generation (JavaScript)
```bash
protoc -I=/proto \
    --js_out=import_style=commonjs:/frontend/generated \
    --grpc-web_out=import_style=commonjs,mode=grpcwebtext:/frontend/generated \
    /proto/task_service.proto
```

**Under the hood - JavaScript generation:**
```
1. protoc with JS plugin
   ↓
2. Creates message classes:
   - Constructor functions
   - Getter/setter methods
   - toObject() for JSON conversion
   - serializeBinary() for wire format
   ↓
3. Creates gRPC-Web client:
   - HTTP/1.1 compatible methods
   - Base64 encoding for binary data
   - Promise-based API wrappers
```

**Generated JavaScript structure:**
```javascript
// task_service_pb.js
proto.taskservice.Task = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};

proto.taskservice.Task.prototype.getId = function() {
  return jspb.Message.getFieldWithDefault(this, 1, "");
};

proto.taskservice.Task.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  // Writes field number + type + data
  writer.writeString(1, this.getId());
  return writer.getResultBuffer();
};

// task_service_grpc_web_pb.js
proto.taskservice.TaskServiceClient = function(hostname, credentials, options) {
  this.client_ = new grpc.web.GrpcWebClientBase(options);
  this.hostname_ = hostname;
};

proto.taskservice.TaskServiceClient.prototype.createTask = function(request, metadata, callback) {
  return this.client_.rpcCall(
    this.hostname_ + '/taskservice.TaskService/CreateTask',
    request,
    metadata || {},
    methodInfo_TaskService_CreateTask,
    callback
  );
};
```

### Phase 2: Docker Image Building

#### Step 1: Backend Docker Build
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
```

**Under the hood:**
```
1. Docker daemon receives build context
   ↓
2. For each instruction:
   a) FROM: Pulls base image layers
      - Downloads if not cached
      - Verifies checksums

   b) WORKDIR: Adds metadata layer
      - No actual filesystem change
      - Sets working directory for subsequent commands

   c) COPY: Creates new layer
      - Calculates file checksums
      - Creates tar archive
      - Adds as new layer

   d) RUN: Executes in container
      - Starts temporary container
      - Runs command
      - Commits changes as new layer
      - Removes temporary container
```

**Layer structure visualization:**
```
Layer 0: python:3.11-slim base (150MB)
Layer 1: WORKDIR /app (0KB - metadata only)
Layer 2: COPY requirements.txt (1KB)
Layer 3: RUN pip install (50MB - installed packages)
Layer 4: COPY . . (Your app code)
Layer 5: CMD ["python", "server.py"] (metadata)
```

### Phase 3: Frontend Build Process

#### Webpack/React Build (Create React App)
```bash
npm run build
```

**Under the hood webpack process:**
```
1. Entry Point Resolution
   ↓
   Webpack starts at src/index.js
   ↓
2. Dependency Graph Building
   ↓
   Follows all imports recursively:
   - index.js → App.tsx
   - App.tsx → grpcClient.ts
   - grpcClient.ts → task_service_pb.js
   ↓
3. Loader Pipeline (for each file)
   ↓
   .tsx file → ts-loader → babel-loader → JavaScript
   .css file → css-loader → style-loader → Injected styles
   ↓
4. Optimization
   ↓
   - Tree shaking: Removes unused code
   - Minification: Reduces file size
   - Code splitting: Creates chunks
   ↓
5. Output Generation
   ↓
   - bundle.js (main application)
   - chunk.js files (lazy loaded)
   - index.html with injected scripts
```

**Detailed transformation example:**
```typescript
// Original TypeScript
const client = new TaskServiceClient();
const response = await client.createTask(request);

// After TypeScript compilation
const client = new TaskServiceClient();
const response = yield client.createTask(request);

// After Babel transformation
var client = new TaskServiceClient();
var response = yield client.createTask(request);

// After minification
var a=new TaskServiceClient();var b=yield a.createTask(c);
```

## Runtime Process: What Happens When You Run

### Step 1: Starting the Services

#### Backend Startup
```bash
python server.py
```

**Under the hood:**
```
1. Python interpreter loads
   ↓
2. Imports grpc and generated files
   ↓
3. Creates gRPC server:
   server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
   - Initializes thread pool
   - Sets up HTTP/2 server
   - Configures keepalive
   ↓
4. Registers service implementation:
   add_TaskServiceServicer_to_server(TaskServiceServicer(), server)
   - Maps RPC paths to methods
   - Sets up serialization/deserialization
   ↓
5. Binds to port and starts:
   server.add_insecure_port('[::]:50051')
   - Creates socket
   - Binds to all interfaces
   - Starts listening
```

**Network stack visualization:**
```
Application Layer:  gRPC Service Methods
                         ↓
gRPC Layer:        Method routing, serialization
                         ↓
HTTP/2 Layer:      Frames, streams, multiplexing
                         ↓
TLS Layer:         Encryption (if enabled)
                         ↓
TCP Layer:         Reliable delivery, ordering
                         ↓
IP Layer:          Routing, addressing
                         ↓
Network Interface: Physical transmission
```

#### Envoy Proxy Startup
```bash
envoy -c /etc/envoy/envoy.yaml
```

**Under the hood:**
```
1. Configuration Loading
   ↓
   Parses YAML → Internal config objects
   ↓
2. Listener Initialization
   ↓
   - Creates HTTP/1.1 listener on :8080
   - Sets up filter chain
   ↓
3. Cluster Discovery
   ↓
   - Resolves backend hostname
   - Establishes health checks
   - Creates connection pool
   ↓
4. Filter Chain Setup
   ↓
   HTTP Connection Manager
     → CORS Filter
     → gRPC-Web Filter
     → Router Filter
   ↓
5. Starts Event Loop
   ↓
   epoll/kqueue for efficient I/O
```

### Step 2: Client Request Flow

#### When user clicks "Create Task"

**1. React Component Action:**
```javascript
const handleCreateTask = async () => {
  const task = await grpcClient.createTask(title, description);
};
```

**2. gRPC-Web Client Processing:**
```
User Input
    ↓
React State Update
    ↓
grpcClient.createTask() called
    ↓
Creates CreateTaskRequest object
    ↓
Serializes to Protocol Buffer binary
    ↓
Base64 encodes binary data
    ↓
Prepares HTTP/1.1 request
```

**3. Network Request Details:**
```http
POST http://localhost:8080/taskservice.TaskService/CreateTask
Content-Type: application/grpc-web+proto
X-Grpc-Web: 1

[5-byte header: 00 00 00 00 1C]
[Base64 encoded protobuf data: CgdUZXN0VGFzaxIQVGVzdCBkZXNjcmlwdGlvbg==]
```

**Header breakdown:**
- Byte 0: Compression flag (0 = no compression)
- Bytes 1-4: Message length (big-endian)

**4. Envoy Processing:**
```
HTTP/1.1 Request arrives
    ↓
HTTP Parser extracts headers/body
    ↓
gRPC-Web filter activated
    ↓
Decodes base64 → binary protobuf
    ↓
Creates HTTP/2 frame
    ↓
Opens HTTP/2 stream to backend
    ↓
Sends gRPC request
```

**5. Backend Processing:**
```
HTTP/2 stream received
    ↓
gRPC server routes to method
    ↓
Deserializes protobuf → Python object
    ↓
TaskServiceServicer.CreateTask() executes
    ↓
Business logic (create task, save to memory)
    ↓
Creates response Task object
    ↓
Serializes to protobuf binary
    ↓
Sends HTTP/2 response + trailers
```

**6. Response Flow:**
```
Backend → Envoy:   HTTP/2 frames with binary data
Envoy processing:  Binary → Base64, HTTP/2 → HTTP/1.1
Envoy → Browser:   HTTP/1.1 response with encoded data
Browser:           Base64 → Binary → JavaScript object
React:             Updates UI with new task
```

## Under the Hood: Deep Dive

### Protocol Buffer Wire Format

**Example: Task with id="123", title="Test"**

Binary representation:
```
0A 03 31 32 33    # Field 1 (id): tag=0A, length=3, value="123"
12 04 54 65 73 74 # Field 2 (title): tag=12, length=4, value="Test"
```

**Encoding details:**
- Tag = (field_number << 3) | wire_type
- Field 1: (1 << 3) | 2 = 0x0A (string type)
- Field 2: (2 << 3) | 2 = 0x12 (string type)
- Length: Varint encoding
- Data: UTF-8 bytes

### HTTP/2 Frame Structure

**gRPC over HTTP/2:**
```
+-----------------------------------------------+
|                 Length (24)                   |
+---------------+---------------+---------------+
|   Type (8)    |   Flags (8)   |
+-+-------------+---------------+-------------------------------+
|R|                 Stream Identifier (31)                      |
+=+=============================================================+
|                   Frame Payload (0...)                      ...
+---------------------------------------------------------------+

HEADERS frame:
- :method: POST
- :path: /taskservice.TaskService/CreateTask
- content-type: application/grpc+proto

DATA frames:
- Protobuf binary data

HEADERS frame (trailers):
- grpc-status: 0
- grpc-message: OK
```

### Memory and Performance

**Backend memory layout:**
```
Python Process Memory
├── Python Runtime (~50MB)
├── gRPC Core Library (~20MB)
├── Thread Pool (10 threads × 8MB stack = 80MB)
├── Task Storage (in-memory dict)
│   └── Each task ~1KB
├── Event Queues (streaming)
│   └── Per client ~10KB
└── HTTP/2 Buffers (~5MB)
```

**Frontend bundle analysis:**
```
dist/
├── index.html (2KB)
├── static/js/
│   ├── main.chunk.js (150KB) - Your app code
│   ├── 2.chunk.js (300KB) - React + dependencies
│   ├── 3.chunk.js (200KB) - gRPC-Web + protobuf
│   └── runtime-main.js (2KB) - Webpack runtime
└── static/css/
    └── main.chunk.css (10KB)
```

## gRPC with Vite/Webpack

### Yes, gRPC-Web works with both Vite and Webpack!

#### Vite Configuration
```javascript
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Required for gRPC-Web compatibility
      'google-protobuf': 'google-protobuf/google-protobuf.js',
    }
  },
  optimizeDeps: {
    include: [
      'google-protobuf',
      'grpc-web'
    ]
  },
  server: {
    proxy: {
      // Proxy gRPC-Web requests to Envoy
      '/taskservice.TaskService': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})
```

#### Webpack Configuration
```javascript
// webpack.config.js
module.exports = {
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    fallback: {
      // Required for gRPC-Web in browser
      "http": false,
      "https": false,
      "stream": false,
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      }
    ]
  },
  devServer: {
    proxy: {
      '/taskservice.TaskService': 'http://localhost:8080'
    }
  }
}
```

### Key Differences:

**Vite advantages:**
- Faster HMR (Hot Module Replacement)
- Better ES modules support
- Simpler configuration

**Webpack advantages:**
- More mature ecosystem
- Better plugin support
- More control over bundling

## Public Endpoints Considerations

### Making gRPC-Web Work with Public Endpoints

#### 1. **HTTPS is Required**
```nginx
server {
    listen 443 ssl http2;
    server_name api.yourapp.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        grpc_pass grpc://localhost:50051;

        # gRPC-Web
        if ($content_type = "application/grpc-web") {
            grpc_pass grpc://envoy:8080;
        }
    }
}
```

#### 2. **CORS Configuration**
```yaml
# Envoy config for public endpoints
cors:
  allow_origin_string_match:
  - prefix: "https://yourapp.com"
  - prefix: "https://www.yourapp.com"
  allow_methods: GET, PUT, DELETE, POST, OPTIONS
  allow_headers: keep-alive,user-agent,cache-control,content-type,x-grpc-web,grpc-timeout
  expose_headers: grpc-status,grpc-message
```

#### 3. **Authentication**
```javascript
// Client-side
const metadata = {
  'authorization': `Bearer ${authToken}`
};

client.createTask(request, metadata, (err, response) => {
  // Handle response
});
```

#### 4. **Rate Limiting**
```yaml
# Envoy rate limit config
http_filters:
- name: envoy.filters.http.ratelimit
  typed_config:
    "@type": type.googleapis.com/envoy.extensions.filters.http.ratelimit.v3.RateLimit
    domain: grpc_web_ratelimit
    rate_limit_service:
      grpc_service:
        envoy_grpc:
          cluster_name: rate_limit_service
```

### Production Architecture for Public Endpoints

```
Internet
    ↓
CloudFlare/CDN (DDoS protection)
    ↓
Load Balancer (SSL termination)
    ↓
Envoy Cluster (Multiple instances)
    ↓
gRPC Backend Services (Auto-scaling)
    ↓
Database Cluster
```

### Security Best Practices for Public gRPC-Web

1. **Always use TLS/HTTPS**
2. **Implement proper authentication (JWT/OAuth)**
3. **Rate limit at multiple levels**
4. **Validate all inputs**
5. **Use API keys for client identification**
6. **Monitor and log all requests**
7. **Implement request timeouts**
8. **Use Web Application Firewall (WAF)**

### Example Production Setup

```javascript
// Client configuration for public endpoint
const client = new TaskServiceClient('https://api.yourapp.com', null, {
  // Enable CORS
  withCredentials: true,

  // Add default metadata
  unaryInterceptors: [
    {
      intercept(request, invoker) {
        const metadata = request.getMetadata();
        metadata['x-api-key'] = 'your-api-key';
        metadata['x-client-version'] = '1.0.0';
        return invoker(request);
      }
    }
  ],

  // Enable compression
  compression: 'gzip',

  // Set timeout
  deadline: Date.now() + 10000, // 10 seconds
});
```

## Summary

The build and run process involves:

1. **Build Time**: Proto compilation → Code generation → Docker building → Frontend bundling
2. **Runtime**: Service startup → Request routing → Protocol translation → Response handling
3. **Under the Hood**: Binary encoding, HTTP/2 framing, memory management, network protocols

gRPC-Web works excellently with both Vite and Webpack, and is production-ready for public endpoints with proper security configurations.