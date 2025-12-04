# Python gRPC Backend Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (except generated files)
COPY backend/ .

# Copy proto files
COPY proto /app/proto

# Generate Python protobuf files (after copying backend to overwrite any stale generated files)
RUN mkdir -p /app/generated && \
    python -m grpc_tools.protoc \
    -I/app/proto \
    --python_out=/app/generated \
    --grpc_python_out=/app/generated \
    /app/proto/task_service.proto && \
    touch /app/generated/__init__.py

# Expose gRPC port
EXPOSE 50051

# Set Python path to include generated files
ENV PYTHONPATH=/app:/app/generated

# Run the server
CMD ["python", "server.py"]