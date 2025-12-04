#!/bin/bash

# Start all services for gRPC-Web demo
# This script handles the complete startup process including proto generation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
USE_DOCKER=${USE_DOCKER:-true}
GENERATE_PROTOS=${GENERATE_PROTOS:-true}
MONITORING=${MONITORING:-false}

# Banner
print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════╗"
    echo "║      gRPC-Web Demo Application       ║"
    echo "║         Startup Script               ║"
    echo "╚══════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check Docker
check_docker() {
    if [[ "$USE_DOCKER" == "true" ]]; then
        if ! command -v docker &> /dev/null; then
            echo -e "${RED}Error: Docker is not installed.${NC}"
            exit 1
        fi

        if ! command -v docker-compose &> /dev/null; then
            echo -e "${RED}Error: Docker Compose is not installed.${NC}"
            exit 1
        fi

        # Check if Docker daemon is running
        if ! docker info &> /dev/null; then
            echo -e "${RED}Error: Docker daemon is not running.${NC}"
            exit 1
        fi

        echo -e "${GREEN}✓ Docker is ready${NC}"
    fi
}

# Generate protocol buffer files
generate_protos() {
    if [[ "$GENERATE_PROTOS" == "true" ]]; then
        echo -e "\n${YELLOW}Generating Protocol Buffer files...${NC}"

        if [[ "$USE_DOCKER" == "true" ]]; then
            # Use Docker for generation
            docker-compose run --rm protogen || {
                echo -e "${YELLOW}Warning: Proto generation via Docker failed. Trying local generation...${NC}"
                bash "$SCRIPT_DIR/generate_protos.sh"
            }
        else
            # Use local generation
            bash "$SCRIPT_DIR/generate_protos.sh"
        fi
    fi
}

# Start services with Docker
start_docker_services() {
    echo -e "\n${YELLOW}Starting services with Docker Compose...${NC}"

    # Build images
    echo -e "${BLUE}Building Docker images...${NC}"
    docker-compose build

    # Start services
    if [[ "$MONITORING" == "true" ]]; then
        echo -e "${BLUE}Starting services with monitoring...${NC}"
        docker-compose --profile monitoring up -d
    else
        echo -e "${BLUE}Starting services...${NC}"
        docker-compose up -d
    fi

    # Wait for services to be healthy
    echo -e "\n${YELLOW}Waiting for services to be ready...${NC}"

    # Wait for backend
    echo -n "Waiting for backend..."
    for i in {1..30}; do
        if docker-compose exec -T backend python -c "import grpc; channel = grpc.insecure_channel('localhost:50051'); channel.close()" 2>/dev/null; then
            echo -e " ${GREEN}Ready!${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done

    # Wait for Envoy
    echo -n "Waiting for Envoy..."
    for i in {1..30}; do
        if curl -s http://localhost:9901/ready &>/dev/null; then
            echo -e " ${GREEN}Ready!${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done

    # Wait for frontend
    echo -n "Waiting for frontend..."
    for i in {1..30}; do
        if curl -s http://localhost:3000 &>/dev/null; then
            echo -e " ${GREEN}Ready!${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done
}

# Start services locally (without Docker)
start_local_services() {
    echo -e "\n${YELLOW}Starting services locally...${NC}"

    # Check Python environment
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Error: Python 3 is not installed.${NC}"
        exit 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js is not installed.${NC}"
        exit 1
    fi

    # Install backend dependencies
    echo -e "${BLUE}Installing backend dependencies...${NC}"
    cd "$PROJECT_ROOT/backend"
    pip install -r requirements.txt

    # Start backend
    echo -e "${BLUE}Starting backend server...${NC}"
    python server.py &
    BACKEND_PID=$!

    # Start Envoy (requires local installation)
    if command -v envoy &> /dev/null; then
        echo -e "${BLUE}Starting Envoy proxy...${NC}"
        envoy -c "$PROJECT_ROOT/envoy/envoy.yaml" &
        ENVOY_PID=$!
    else
        echo -e "${YELLOW}Warning: Envoy not installed locally. Please run Envoy separately.${NC}"
    fi

    # Install frontend dependencies
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    cd "$PROJECT_ROOT/frontend"
    npm install

    # Start frontend
    echo -e "${BLUE}Starting frontend...${NC}"
    npm start &
    FRONTEND_PID=$!

    # Save PIDs for cleanup
    echo "$BACKEND_PID" > /tmp/grpc-demo-backend.pid
    echo "$ENVOY_PID" > /tmp/grpc-demo-envoy.pid
    echo "$FRONTEND_PID" > /tmp/grpc-demo-frontend.pid

    echo -e "\n${GREEN}Services started locally!${NC}"
    echo "PIDs saved to /tmp/grpc-demo-*.pid"
}

# Show service URLs
show_urls() {
    echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
    echo -e "${GREEN}✓ All services are running!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}Service URLs:${NC}"
    echo -e "  • Frontend:        ${GREEN}http://localhost:3000${NC}"
    echo -e "  • gRPC-Web Proxy:  ${GREEN}http://localhost:8080${NC}"
    echo -e "  • Envoy Admin:     ${GREEN}http://localhost:9901${NC}"
    echo -e "  • gRPC Backend:    ${GREEN}localhost:50051${NC}"

    if [[ "$MONITORING" == "true" ]]; then
        echo -e "  • Prometheus:      ${GREEN}http://localhost:9090${NC}"
        echo -e "  • Grafana:         ${GREEN}http://localhost:3001${NC} (admin/admin)"
    fi

    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    if [[ "$USE_DOCKER" == "true" ]]; then
        echo "  • View logs:       docker-compose logs -f"
        echo "  • Stop services:   docker-compose down"
        echo "  • Restart:         docker-compose restart"
    else
        echo "  • Stop services:   $SCRIPT_DIR/stop_all.sh"
    fi
    echo ""
}

# Trap for cleanup
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    if [[ "$USE_DOCKER" == "true" ]]; then
        docker-compose down
    else
        # Kill local processes
        if [[ -f /tmp/grpc-demo-backend.pid ]]; then
            kill $(cat /tmp/grpc-demo-backend.pid) 2>/dev/null || true
        fi
        if [[ -f /tmp/grpc-demo-envoy.pid ]]; then
            kill $(cat /tmp/grpc-demo-envoy.pid) 2>/dev/null || true
        fi
        if [[ -f /tmp/grpc-demo-frontend.pid ]]; then
            kill $(cat /tmp/grpc-demo-frontend.pid) 2>/dev/null || true
        fi
    fi
    echo -e "${GREEN}Services stopped.${NC}"
}

# Main execution
main() {
    print_banner

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-docker)
                USE_DOCKER=false
                shift
                ;;
            --skip-proto)
                GENERATE_PROTOS=false
                shift
                ;;
            --monitoring)
                MONITORING=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --no-docker    Start services locally without Docker"
                echo "  --skip-proto   Skip protocol buffer generation"
                echo "  --monitoring   Start with monitoring stack (Prometheus/Grafana)"
                echo "  --help         Show this help message"
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                exit 1
                ;;
        esac
    done

    # Set trap for cleanup
    trap cleanup EXIT INT TERM

    # Change to project root
    cd "$PROJECT_ROOT"

    # Check requirements
    if [[ "$USE_DOCKER" == "true" ]]; then
        check_docker
    fi

    # Generate protocol buffers
    generate_protos

    # Start services
    if [[ "$USE_DOCKER" == "true" ]]; then
        start_docker_services
    else
        start_local_services
    fi

    # Show URLs
    show_urls

    # Keep script running if not using Docker
    if [[ "$USE_DOCKER" != "true" ]]; then
        echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
        wait
    fi
}

# Run main
main "$@"