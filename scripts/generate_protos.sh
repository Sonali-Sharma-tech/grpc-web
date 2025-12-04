#!/bin/bash

# Generate Protocol Buffer files for both backend and frontend
# This script generates Python and JavaScript/TypeScript files from .proto definitions

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${YELLOW}Starting Protocol Buffer generation...${NC}"

# Check if required tools are installed
check_requirements() {
    echo "Checking requirements..."

    # Check for protoc
    if ! command -v protoc &> /dev/null; then
        echo -e "${RED}Error: protoc (Protocol Buffer compiler) is not installed.${NC}"
        echo "Please install protobuf compiler:"
        echo "  macOS: brew install protobuf"
        echo "  Ubuntu: apt-get install protobuf-compiler"
        exit 1
    fi

    # Check for Python gRPC tools
    if ! python -c "import grpc_tools" &> /dev/null; then
        echo -e "${YELLOW}Installing Python gRPC tools...${NC}"
        pip install grpcio-tools
    fi

    # Check for grpc-web plugin
    if ! command -v protoc-gen-grpc-web &> /dev/null; then
        echo -e "${RED}Error: protoc-gen-grpc-web is not installed.${NC}"
        echo "Please install it:"
        echo "  npm install -g protoc-gen-grpc-web"
        exit 1
    fi

    echo -e "${GREEN}All requirements satisfied!${NC}"
}

# Generate Python files for backend
generate_python() {
    echo -e "\n${YELLOW}Generating Python files...${NC}"

    # Create output directory
    PYTHON_OUT="$PROJECT_ROOT/backend/generated"
    mkdir -p "$PYTHON_OUT"

    # Generate Python protobuf and gRPC files
    python -m grpc_tools.protoc \
        -I"$PROJECT_ROOT/proto" \
        --python_out="$PYTHON_OUT" \
        --grpc_python_out="$PYTHON_OUT" \
        "$PROJECT_ROOT/proto/task_service.proto"

    # Fix imports in generated files (common issue with protoc)
    echo "Fixing Python imports..."
    find "$PYTHON_OUT" -name "*_pb2*.py" -type f -exec sed -i.bak \
        's/^import task_service_pb2/from . import task_service_pb2/g' {} \;

    # Remove backup files
    find "$PYTHON_OUT" -name "*.bak" -type f -delete

    # Create __init__.py
    touch "$PYTHON_OUT/__init__.py"

    echo -e "${GREEN}Python files generated successfully!${NC}"
}

# Generate JavaScript files for frontend
generate_javascript() {
    echo -e "\n${YELLOW}Generating JavaScript files...${NC}"

    # Create output directory
    JS_OUT="$PROJECT_ROOT/frontend/src/generated"
    mkdir -p "$JS_OUT"

    # Generate JavaScript protobuf files
    protoc \
        -I"$PROJECT_ROOT/proto" \
        --js_out=import_style=commonjs,binary:"$JS_OUT" \
        "$PROJECT_ROOT/proto/task_service.proto"

    # Generate gRPC-Web service client
    protoc \
        -I"$PROJECT_ROOT/proto" \
        --grpc-web_out=import_style=commonjs,mode=grpcwebtext:"$JS_OUT" \
        "$PROJECT_ROOT/proto/task_service.proto"

    echo -e "${GREEN}JavaScript files generated successfully!${NC}"
}

# Generate TypeScript definitions (optional)
generate_typescript_defs() {
    echo -e "\n${YELLOW}Generating TypeScript definitions...${NC}"

    # Check if protoc-gen-ts is installed
    if ! command -v protoc-gen-ts &> /dev/null; then
        echo -e "${YELLOW}protoc-gen-ts not found. Skipping TypeScript generation.${NC}"
        echo "To enable TypeScript generation, install: npm install -g @improbable-eng/protoc-gen-ts"
        return
    fi

    TS_OUT="$PROJECT_ROOT/frontend/src/generated"

    # Generate TypeScript definitions
    protoc \
        -I"$PROJECT_ROOT/proto" \
        --ts_out=service=true:"$TS_OUT" \
        "$PROJECT_ROOT/proto/task_service.proto"

    echo -e "${GREEN}TypeScript definitions generated successfully!${NC}"
}

# Main execution
main() {
    echo -e "${GREEN}=== gRPC-Web Protocol Buffer Generation ===${NC}"
    echo "Project root: $PROJECT_ROOT"

    # Check requirements
    check_requirements

    # Generate files
    generate_python
    generate_javascript
    # generate_typescript_defs  # Optional

    echo -e "\n${GREEN}✓ All protocol buffer files generated successfully!${NC}"
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Backend: The generated files are in backend/generated/"
    echo "2. Frontend: The generated files are in frontend/src/generated/"
    echo "3. You may need to restart your development servers"
}

# Run main function
main "$@"