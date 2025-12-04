#!/bin/bash
# Simple protobuf generation script

echo "Generating Protocol Buffer files..."

# Generate Python files
python -m grpc_tools.protoc \
    -I/proto \
    --python_out=/backend/generated \
    --grpc_python_out=/backend/generated \
    /proto/task_service.proto

echo "Python protobuf files generated!"

# Generate JavaScript files (if protoc-gen-js is available)
if command -v protoc-gen-js &> /dev/null; then
    protoc -I=/proto \
        --js_out=import_style=commonjs:/frontend/generated \
        --grpc-web_out=import_style=commonjs,mode=grpcwebtext:/frontend/generated \
        /proto/task_service.proto
    echo "JavaScript protobuf files generated!"
else
    echo "Warning: protoc-gen-js not found, skipping JavaScript generation"
fi

echo "Protobuf generation complete!"