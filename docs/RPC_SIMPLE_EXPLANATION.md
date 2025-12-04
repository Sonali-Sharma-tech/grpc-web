# RPC (Remote Procedure Call) - Simple Explanation

## What is RPC in the Simplest Terms?

**RPC = Calling a function that runs on another computer**

### Real-World Example: Pizza Ordering

```
You (Client)          Pizza Place (Server)
     │                        │
     ├──"One large pizza"───>│
     │                        │ (Makes pizza)
     │<───"Pizza ready!"──────│
```

## Simple Code Example

### Without RPC (Local Function)
```python
# Everything runs on YOUR computer
def add_numbers(a, b):
    return a + b

result = add_numbers(5, 3)  # Returns 8
```

### With RPC (Remote Function)
```python
# Function runs on ANOTHER computer
result = remote_server.add_numbers(5, 3)  # Still returns 8!
```

The magic: You call it like a normal function, but it runs somewhere else!

## Technical Breakdown

### 1. Traditional Function Call (Local)
```
Your Computer:
┌─────────────────────────────┐
│ 1. Call add(5, 3)           │
│ 2. CPU executes             │
│ 3. Returns 8                │
│ 4. Continue with result     │
└─────────────────────────────┘
```

### 2. RPC Function Call (Remote)
```
Your Computer:                    Server Computer:
┌─────────────────┐              ┌─────────────────┐
│ 1. Call add(5,3)│              │                 │
│                 ├─────────────>│ 2. Receives call│
│ 4. Gets result  │              │ 3. Executes add │
│    (8)          │<─────────────│ Returns 8       │
└─────────────────┘              └─────────────────┘
```

## How RPC Works Step-by-Step

### Step 1: Client Stub
```python
# What you write:
result = server.calculate_tax(100)

# What actually happens behind the scenes:
def calculate_tax_stub(amount):
    # 1. Package the request
    request = {
        "method": "calculate_tax",
        "params": [100]
    }

    # 2. Send over network
    response = send_to_server(request)

    # 3. Unpack and return
    return response["result"]
```

### Step 2: Network Transport
```
Client Stub → Serialize → Network → Deserialize → Server
    │                                                 │
    └──────────────── TCP/HTTP Connection ───────────┘
```

### Step 3: Server Execution
```python
# Server side:
def handle_request(request):
    method_name = request["method"]      # "calculate_tax"
    params = request["params"]           # [100]

    # Find and call the actual function
    if method_name == "calculate_tax":
        result = calculate_tax(params[0])  # Local execution

    # Send back result
    return {"result": result}
```

## gRPC Example - Real Code

### 1. Define the Service (Proto File)
```protobuf
// calculator.proto
service Calculator {
    rpc Add(AddRequest) returns (AddResponse);
}

message AddRequest {
    int32 a = 1;
    int32 b = 2;
}

message AddResponse {
    int32 result = 1;
}
```

### 2. Server Implementation (Python)
```python
class CalculatorService:
    def Add(self, request, context):
        # This runs on the server
        result = request.a + request.b
        return AddResponse(result=result)
```

### 3. Client Usage (Python)
```python
# This runs on your computer
stub = CalculatorStub(channel)
response = stub.Add(AddRequest(a=5, b=3))
print(response.result)  # Prints: 8
```

## Visual Flow of gRPC Call

```
Your App                    gRPC Client              Network              gRPC Server           Calculator Service
   │                           │                        │                      │                        │
   ├─ add(5, 3) ──────────────>│                        │                      │                        │
   │                           ├─ Serialize to Proto ───>│                      │                        │
   │                           │                        ├─ HTTP/2 Request ────>│                        │
   │                           │                        │                      ├─ Deserialize ─────────>│
   │                           │                        │                      │                        ├─ 5 + 3 = 8
   │                           │                        │                      │<─ Return 8 ─────────────┤
   │                           │                        │<─ HTTP/2 Response ───┤                        │
   │                           │<─ Deserialize ─────────┤                      │                        │
   │<─ Returns 8 ──────────────┤                        │                      │                        │
```

## Key Concepts Explained

### Serialization/Deserialization
- **Serialize**: Convert data to bytes for network transfer
  - Like packing a gift in a box for shipping
- **Deserialize**: Convert bytes back to data
  - Like unpacking the gift at destination

### Stub
- Client-side proxy that pretends to be the remote function
- Handles all the networking complexity
- You call the stub like a normal function

### Why Use RPC?

1. **Simplicity**: Call remote functions like local ones
2. **Language Independence**: Python client can call Java server
3. **Type Safety**: Know exactly what data to send/receive
4. **Performance**: Binary format is faster than JSON

## Common RPC Frameworks

| Framework | Use Case | Protocol |
|-----------|----------|----------|
| gRPC | High performance, streaming | HTTP/2 + Protobuf |
| JSON-RPC | Simple, human-readable | HTTP + JSON |
| XML-RPC | Legacy systems | HTTP + XML |
| Apache Thrift | Facebook scale | Custom binary |

## Real-World Examples

1. **Google Search**
   ```
   You: search("cute cats")
   Google Server: Returns search results
   ```

2. **Banking App**
   ```
   App: transfer_money(from_account, to_account, amount)
   Bank Server: Processes transfer, returns confirmation
   ```

3. **Video Streaming**
   ```
   Netflix App: get_video("movie_id")
   Netflix Server: Streams video data
   ```

## The Magic of RPC

The beauty is that complex network communication looks like simple function calls:

```python
# Without RPC - Complex networking code
socket = create_connection("server.com", 8080)
socket.send(json.dumps({"method": "add", "params": [5, 3]}))
response = socket.recv(1024)
result = json.loads(response)["result"]

# With RPC - Clean and simple
result = server.add(5, 3)
```

## Summary

**RPC makes calling functions on other computers as easy as calling local functions!**

- You write: `server.doSomething()`
- RPC handles: packaging, sending, receiving, unpacking
- Server executes the actual function
- You get the result back

It's like having a magic telephone where you can ask another computer to do work for you and send back the answer!