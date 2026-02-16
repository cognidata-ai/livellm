// ═══════════════════════════════════════════════════════════════
// LiveLLM Response Protocol
//
// Standardized contract for server ↔ client communication.
// ═══════════════════════════════════════════════════════════════

// Types
export type {
  UsageInfo,
  TokenEvent,
  ErrorEvent,
  MetadataEvent,
  DoneEvent,
  StreamEvent,
  StreamEventType,
  LiveLLMResponse,
  LiveLLMActionPayload,
  LiveLLMChatRequest,
} from './types';

// Type guards
export {
  isStreamEvent,
  isTokenEvent,
  isErrorEvent,
  isMetadataEvent,
  isDoneEvent,
} from './types';

// Server helpers
export type { SSEWritable, SSEWriter } from './server';
export { createSSEWriter, formatActionAsMessage } from './server';

// Client helpers
export type { StreamRendererLike, ConnectStreamOptions } from './client';
export { parseSSEData, parseSSELine, connectLiveLLMStream } from './client';
