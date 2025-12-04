# Envoy Proxy Configuration Guide

## 🌉 Why Envoy is Essential for gRPC-Web

### The Browser Limitation Problem

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │   ❌    │ gRPC Server │         │   Browser   │
│  (HTTP/1.1) │ ----X--> │  (HTTP/2)   │   BUT   │  (HTTP/1.1) │
└─────────────┘         └─────────────┘         └─────────────┘
                                                         │
                                                         ✅
                                                         ▼
                                                 ┌─────────────┐
                                                 │    Envoy    │
                                                 │   (Proxy)   │
                                                 └─────────────┘
                                                         │
                                                         ▼
                                                 ┌─────────────┐
                                                 │ gRPC Server │
                                                 │  (HTTP/2)   │
                                                 └─────────────┘
```

**Key Issues:**
1. Browsers cannot make native HTTP/2 connections
2. gRPC requires HTTP/2 with trailers
3. Browser fetch API doesn't support HTTP/2 trailers
4. CORS must be handled at the proxy level

## 🔧 Envoy Configuration Breakdown

### 1. **Admin Interface**

```yaml
admin:
  access_log_path: /tmp/admin_access.log
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 9901
```

**Purpose:** Debugging and monitoring interface
**Access:** http://localhost:9901
**Features:**
- View configuration
- Check cluster health
- Access statistics
- Modify runtime settings

### 2. **Listener Configuration**

```yaml
listeners:
  - name: listener_0
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 8080
```

**What it does:**
- Accepts incoming HTTP/1.1 connections from browsers
- Listens on port 8080 for gRPC-Web requests
- Binds to all interfaces (0.0.0.0)

### 3. **HTTP Connection Manager**

```yaml
- name: envoy.filters.network.http_connection_manager
  typed_config:
    codec_type: AUTO  # Detects HTTP/1.1 or HTTP/2
```

**Key Features:**
- Protocol detection and conversion
- Request routing
- Filter chain processing

### 4. **Critical Filters (Order Matters!)**

```yaml
http_filters:
  # 1. gRPC-Web Filter - MUST be first
  - name: envoy.filters.http.grpc_web

  # 2. CORS Filter - Handles browser security
  - name: envoy.filters.http.cors

  # 3. Router - MUST be last
  - name: envoy.filters.http.router
```

#### **gRPC-Web Filter**
Translates between:
- gRPC-Web (HTTP/1.1) ← → gRPC (HTTP/2)
- Base64 encoding for binary data
- Trailer handling

#### **CORS Filter**
Essential for browser security:
```yaml
cors:
  allow_origin_string_match:
    - prefix: "*"  # Configure specific origins in production
  allow_headers: authorization,content-type,x-grpc-web
  expose_headers: grpc-status,grpc-message
```

### 5. **Upstream Cluster Configuration**

```yaml
clusters:
  - name: grpc_backend_cluster
    type: LOGICAL_DNS
    lb_policy: ROUND_ROBIN
```

**Load Balancing Options:**
- `ROUND_ROBIN`: Distribute evenly
- `LEAST_REQUEST`: Send to least busy
- `RANDOM`: Random selection
- `RING_HASH`: Consistent hashing

### 6. **HTTP/2 Settings for gRPC**

```yaml
http2_protocol_options:
  max_concurrent_streams: 1000
  initial_stream_window_size: 65536
  initial_connection_window_size: 1048576
```

**Why these matter:**
- Concurrent streams: Multiple gRPC calls over one connection
- Window sizes: Flow control for backpressure
- Keep-alive: Detect dead connections

## 🔍 Request Flow Through Envoy

### 1. **Browser → Envoy (gRPC-Web)**

```http
POST /taskservice.TaskService/CreateTask HTTP/1.1
Content-Type: application/grpc-web+proto
X-Grpc-Web: 1

[Base64 encoded protobuf]
```

### 2. **Envoy Processing**

1. Accept HTTP/1.1 connection
2. Decode gRPC-Web format
3. Apply CORS headers
4. Convert to HTTP/2 frames

### 3. **Envoy → Backend (gRPC)**

```http
POST /taskservice.TaskService/CreateTask HTTP/2
Content-Type: application/grpc
TE: trailers

[Binary protobuf]
```

### 4. **Response Path**

Backend → Envoy → Browser with reverse translation

## 🛡️ Security Features

### 1. **CORS Configuration**

```yaml
cors:
  allow_origin_string_match:
    - prefix: "https://app.example.com"
    - exact: "http://localhost:3000"
  allow_credentials: true
```

### 2. **TLS Termination**

```yaml
transport_socket:
  name: envoy.transport_sockets.tls
  typed_config:
    common_tls_context:
      tls_certificates:
        - certificate_chain:
            filename: /etc/envoy/cert.pem
          private_key:
            filename: /etc/envoy/key.pem
```

### 3. **Rate Limiting**

```yaml
http_filters:
  - name: envoy.filters.http.ratelimit
    typed_config:
      rate_limit_service:
        grpc_service:
          envoy_grpc:
            cluster_name: rate_limit_cluster
```

## 📊 Monitoring & Observability

### 1. **Access Logs**

```yaml
access_log:
  - name: envoy.access_loggers.stdout
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.access_loggers.stream.v3.StdoutAccessLog
```

### 2. **Metrics Endpoints**

- `/stats`: All statistics
- `/stats/prometheus`: Prometheus format
- `/clusters`: Cluster health
- `/ready`: Readiness check

### 3. **Tracing Integration**

```yaml
tracing:
  provider:
    name: envoy.tracers.zipkin
    typed_config:
      collector_cluster: zipkin
      collector_endpoint: "/api/v2/spans"
```

## 🚨 Common Issues & Solutions

### 1. **CORS Errors**

```
Access to fetch at 'http://localhost:8080' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution:** Ensure CORS filter is configured and allow_headers includes all gRPC-Web headers.

### 2. **Connection Timeouts**

```yaml
route:
  timeout: 0s  # Disable timeout for streaming
  max_stream_duration:
    grpc_timeout_header_max: 0s
```

### 3. **413 Request Entity Too Large**

```yaml
per_connection_buffer_limit_bytes: 10485760  # 10MB
```

### 4. **Health Check Failures**

```yaml
health_checks:
  - grpc_health_check:
      service_name: ""
      authority: backend.service.local
```

## 🎯 Performance Tuning

### 1. **Connection Pooling**

```yaml
circuit_breakers:
  thresholds:
    - max_connections: 1000
      max_pending_requests: 1000
```

### 2. **HTTP/2 Optimization**

```yaml
http2_protocol_options:
  hpack_table_size: 4096
  max_concurrent_streams: 100
  initial_stream_window_size: 268435456  # 256MB
```

### 3. **Buffer Tuning**

```yaml
per_connection_buffer_limit_bytes: 1048576  # 1MB
```

## 🔄 Advanced Patterns

### 1. **Request Retry**

```yaml
route:
  retry_policy:
    retry_on: "5xx,reset,retriable-4xx"
    num_retries: 3
    per_try_timeout: 5s
```

### 2. **Load Balancing with Health Checks**

```yaml
outlier_detection:
  consecutive_5xx: 5
  interval: 30s
  base_ejection_time: 30s
```

### 3. **Traffic Splitting**

```yaml
routes:
  - match:
      prefix: "/"
      headers:
        - name: "x-version"
          exact_match: "v2"
    route:
      cluster: grpc_backend_v2
  - match:
      prefix: "/"
    route:
      cluster: grpc_backend_v1
```

## 🧪 Testing Envoy Configuration

### 1. **Configuration Validation**

```bash
envoy --mode validate --config-path envoy.yaml
```

### 2. **Debug Logging**

```yaml
static_resources:
  listeners:
    - name: listener_0
      per_connection_buffer_limit_bytes: 1048576
      # Enable debug logs
      typed_config:
        access_log:
          - name: envoy.access_loggers.stdout
```

### 3. **Testing with grpcurl**

```bash
# Test through Envoy
grpcurl -plaintext \
  -H "X-Grpc-Web: 1" \
  localhost:8080 \
  taskservice.TaskService/ListTasks
```