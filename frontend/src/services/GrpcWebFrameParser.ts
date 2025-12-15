// gRPC-Web Frame Parser for fetch-based streaming
// Handles grpcwebtext mode (base64 encoded)

export interface GrpcWebFrame {
  flag: number;      // 0x00 = DATA, 0x80 = TRAILERS
  payload: Uint8Array;
}

export interface ParseResult {
  frames: GrpcWebFrame[];
  remaining: string;  // Leftover base64 that didn't complete a frame
}

/**
 * Serialize a protobuf message into gRPC-Web request format (base64 encoded)
 * Frame format: [1 byte flag][4 bytes length (big-endian)][payload]
 */
export function serializeGrpcWebRequest(message: { serializeBinary: () => Uint8Array }): string {
  const binary = message.serializeBinary();

  // Create frame: 1 byte flag (0x00 for DATA) + 4 bytes length + payload
  const frame = new Uint8Array(5 + binary.length);
  frame[0] = 0x00; // DATA frame flag

  // Big-endian length
  frame[1] = (binary.length >> 24) & 0xff;
  frame[2] = (binary.length >> 16) & 0xff;
  frame[3] = (binary.length >> 8) & 0xff;
  frame[4] = binary.length & 0xff;

  // Copy payload
  frame.set(binary, 5);

  // Base64 encode for grpcwebtext mode
  let binaryStr = '';
  for (let i = 0; i < frame.length; i++) {
    binaryStr += String.fromCharCode(frame[i]);
  }
  return btoa(binaryStr);
}

/**
 * Parse base64-encoded gRPC-Web frames from a buffer
 * Handles partial data - returns remaining unparsed base64
 */
export function parseBase64GrpcFrames(base64Buffer: string): ParseResult {
  const frames: GrpcWebFrame[] = [];

  // Base64 encodes 3 bytes as 4 characters
  // Only process complete 4-character chunks
  const completeChunks = Math.floor(base64Buffer.length / 4) * 4;

  if (completeChunks === 0) {
    return { frames, remaining: base64Buffer };
  }

  const processable = base64Buffer.substring(0, completeChunks);
  let remaining = base64Buffer.substring(completeChunks);

  // Decode base64 to binary
  let bytes: Uint8Array;
  try {
    const binaryString = atob(processable);
    bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
  } catch (e) {
    // Invalid base64 - return as remaining for next chunk
    return { frames, remaining: base64Buffer };
  }

  // Parse gRPC frames from binary
  let offset = 0;

  while (offset + 5 <= bytes.length) {
    const flag = bytes[offset];
    const length = (bytes[offset + 1] << 24) |
                   (bytes[offset + 2] << 16) |
                   (bytes[offset + 3] << 8) |
                   bytes[offset + 4];

    // Check if we have the complete frame
    if (offset + 5 + length > bytes.length) {
      // Incomplete frame - re-encode remaining bytes back to base64
      const remainingBytes = bytes.slice(offset);
      const reEncoded = bytesToBase64(remainingBytes);
      return { frames, remaining: reEncoded + remaining };
    }

    // Extract complete frame
    frames.push({
      flag,
      payload: bytes.slice(offset + 5, offset + 5 + length),
    });

    offset += 5 + length;
  }

  // Handle any leftover bytes that don't form a complete header
  if (offset < bytes.length) {
    const remainingBytes = bytes.slice(offset);
    const reEncoded = bytesToBase64(remainingBytes);
    return { frames, remaining: reEncoded + remaining };
  }

  return { frames, remaining };
}

/**
 * Convert Uint8Array to base64 string
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Check if a frame is a trailer frame (contains gRPC status)
 */
export function isTrailerFrame(frame: GrpcWebFrame): boolean {
  return (frame.flag & 0x80) !== 0;
}

/**
 * Parse trailer frame to extract gRPC status
 */
export function parseTrailers(frame: GrpcWebFrame): { code: number; message: string } {
  const text = new TextDecoder().decode(frame.payload);
  const lines = text.split('\r\n');

  let code = 0;
  let message = '';

  for (const line of lines) {
    if (line.startsWith('grpc-status:')) {
      code = parseInt(line.substring(12).trim(), 10);
    } else if (line.startsWith('grpc-message:')) {
      message = line.substring(13).trim();
    }
  }

  return { code, message };
}
