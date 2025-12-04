#!/bin/bash

# Stop all services for gRPC-Web demo

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${YELLOW}Stopping gRPC-Web Demo services...${NC}"

# Check if Docker Compose is being used
if docker-compose ps &>/dev/null; then
    echo -e "${BLUE}Stopping Docker services...${NC}"
    docker-compose down
    echo -e "${GREEN}✓ Docker services stopped${NC}"
fi

# Stop local services
if [[ -f /tmp/grpc-demo-backend.pid ]]; then
    echo "Stopping backend server..."
    kill $(cat /tmp/grpc-demo-backend.pid) 2>/dev/null || true
    rm /tmp/grpc-demo-backend.pid
fi

if [[ -f /tmp/grpc-demo-envoy.pid ]]; then
    echo "Stopping Envoy proxy..."
    kill $(cat /tmp/grpc-demo-envoy.pid) 2>/dev/null || true
    rm /tmp/grpc-demo-envoy.pid
fi

if [[ -f /tmp/grpc-demo-frontend.pid ]]; then
    echo "Stopping frontend..."
    kill $(cat /tmp/grpc-demo-frontend.pid) 2>/dev/null || true
    rm /tmp/grpc-demo-frontend.pid
fi

# Kill any remaining processes on known ports
echo "Cleaning up ports..."
lsof -ti:50051 | xargs kill -9 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo -e "${GREEN}✓ All services stopped${NC}"