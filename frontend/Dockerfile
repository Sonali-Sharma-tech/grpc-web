# React Frontend Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install protobuf compiler and tools
RUN apk add --no-cache protobuf protobuf-dev

# Copy package files
COPY frontend/package.json ./
RUN npm install --legacy-peer-deps

# Install global dependencies for protobuf generation
RUN npm install -g protoc-gen-grpc-web protoc-gen-js

# Copy the rest of the application
COPY frontend/ .

# Expose port
EXPOSE 3000

# Start the development server
CMD ["npm", "start"]

# For production build:
# RUN npm run build
# FROM nginx:alpine
# COPY --from=0 /app/build /usr/share/nginx/html
# COPY nginx.conf /etc/nginx/conf.d/default.conf
# EXPOSE 80
# CMD ["nginx", "-g", "daemon off;"]