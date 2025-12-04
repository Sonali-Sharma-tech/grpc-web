# Docker Deployment Guide

## 🐳 Docker Architecture

Our multi-container setup provides a production-ready gRPC-Web environment:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Browser     │     │  React (3000)   │     │  Envoy (8080)   │
│                 │ --> │   Web App       │ --> │   gRPC-Web      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ Python (50051)  │
                                                 │  gRPC Server    │
                                                 └─────────────────┘
```

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd grpc-web-demo

# 2. Start all services
docker-compose up

# 3. Access the application
# Frontend: http://localhost:3000
# Envoy Admin: http://localhost:9901
# gRPC Server: localhost:50051
```

## 📦 Service Breakdown

### 1. **Backend Service** (Python gRPC Server)

```yaml
backend:
  build: ./backend
  ports:
    - "50051:50051"  # gRPC port
```

**Features:**
- Auto-generates protobuf Python files
- Health checks for reliability
- Volume mounting for development
- Environment variables for debugging

### 2. **Envoy Proxy**

```yaml
envoy:
  image: envoyproxy/envoy:v1.28-latest
  ports:
    - "8080:8080"   # gRPC-Web port
    - "9901:9901"   # Admin interface
```

**Purpose:**
- Translates gRPC-Web ← → gRPC
- Handles CORS
- Provides metrics and admin interface

### 3. **Frontend Service** (React)

```yaml
frontend:
  build: ./frontend
  ports:
    - "3000:3000"
  environment:
    - REACT_APP_GRPC_WEB_URL=http://localhost:8080
```

**Features:**
- Hot reloading in development
- Environment-based configuration
- Volume mounting for live updates

### 4. **Protocol Buffer Generation**

```yaml
protogen:
  build:
    dockerfile: Dockerfile.protogen
  command: /scripts/generate_all_protos.sh
```

**Usage:**
```bash
# Generate all protobuf files
docker-compose run --rm protogen

# Or generate individually
docker-compose run --rm protogen /scripts/generate_backend_protos.sh
docker-compose run --rm protogen /scripts/generate_frontend_protos.sh
```

## 🛠️ Development Workflow

### Hot Reloading

All services support hot reloading:
- **Backend**: Python files auto-reload on change
- **Frontend**: React dev server with HMR
- **Envoy**: Restart required for config changes

### Debugging

```bash
# View logs for all services
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f envoy
docker-compose logs -f frontend

# Access container shell
docker-compose exec backend bash
docker-compose exec frontend sh
```

### Environment Variables

```bash
# Create .env file for local overrides
cat > .env << EOF
GRPC_VERBOSITY=DEBUG
REACT_APP_GRPC_WEB_URL=http://localhost:8080
ENVOY_LOG_LEVEL=debug
EOF
```

## 📊 Monitoring Stack (Optional)

Enable monitoring with Prometheus and Grafana:

```bash
# Start with monitoring profile
docker-compose --profile monitoring up

# Access:
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin)
```

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'envoy'
    static_configs:
      - targets: ['envoy:9901']

  - job_name: 'backend'
    static_configs:
      - targets: ['backend:8000']
```

## 🔧 Production Considerations

### 1. **Security**

```dockerfile
# Use specific versions
FROM python:3.11-slim

# Run as non-root user
RUN useradd -m appuser
USER appuser

# Use secrets for sensitive data
env_file:
  - .env.production
```

### 2. **Performance**

```yaml
# Resource limits
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### 3. **Scaling**

```bash
# Scale backend instances
docker-compose up --scale backend=3

# Use external load balancer
# Configure Envoy to route to multiple backends
```

### 4. **Health Checks**

```yaml
healthcheck:
  test: ["CMD", "grpc_health_probe", "-addr=:50051"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## 🚨 Troubleshooting

### Common Issues

#### 1. **Port Already in Use**
```bash
# Check which process is using the port
lsof -i :3000
lsof -i :8080
lsof -i :50051

# Or change ports in docker-compose.yml
```

#### 2. **Container Can't Connect**
```bash
# Verify network
docker network ls
docker network inspect grpc-web-demo_grpc-network

# Test connectivity
docker-compose exec frontend ping envoy
docker-compose exec envoy ping backend
```

#### 3. **Protobuf Generation Fails**
```bash
# Manually generate
docker-compose run --rm protogen bash
cd /proto
protoc --python_out=/backend/generated \
       --grpc_python_out=/backend/generated \
       task_service.proto
```

#### 4. **Envoy Configuration Issues**
```bash
# Validate Envoy config
docker-compose run --rm envoy \
  envoy --mode validate -c /etc/envoy/envoy.yaml

# Check Envoy admin interface
curl http://localhost:9901/stats
curl http://localhost:9901/clusters
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build services
        run: docker-compose build

      - name: Run tests
        run: |
          docker-compose run --rm backend pytest
          docker-compose run --rm frontend npm test

      - name: Integration tests
        run: docker-compose up -d && ./scripts/integration_tests.sh
```

### Production Deployment

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Push to registry
docker-compose -f docker-compose.prod.yml push

# Deploy to Kubernetes
kubectl apply -f k8s/
```

## 📋 Useful Commands

```bash
# Remove all containers and volumes
docker-compose down -v

# Rebuild specific service
docker-compose build backend

# View resource usage
docker stats

# Clean up unused resources
docker system prune -a

# Export/Import data
docker-compose exec backend python manage.py export_data
docker-compose exec backend python manage.py import_data

# Run one-off commands
docker-compose run --rm backend python -m pytest
docker-compose run --rm frontend npm run lint
```