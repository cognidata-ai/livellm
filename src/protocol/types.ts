// ═══════════════════════════════════════════════════════════════
// LiveLLM Response Protocol — Type Definitions
//
// Standardized contract for server ↔ client communication.
// Covers SSE streaming, static responses, and bidirectional actions.
// ═══════════════════════════════════════════════════════════════

// ─── Usage Info ─────────────────────────────────────────────

export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// ─── SSE Stream Events (server → client) ────────────────────

/**
 * A single text token from the LLM response.
 */
export interface TokenEvent {
  type: 'token';
  token: string;
}

/**
 * An error that occurred during streaming.
 */
export interface ErrorEvent {
  type: 'error';
  code: 'provider_error' | 'rate_limit' | 'context_overflow' | 'timeout' | 'unknown';
  message: string;
  recoverable: boolean;
}

/**
 * Metadata about the generation session.
 * Typically sent once at the start (model info) and/or at the end (usage stats).
 */
export interface MetadataEvent {
  type: 'metadata';
  model?: string;
  provider?: string;
  usage?: UsageInfo;
  latency_ms?: number;
}

/**
 * Signals the end of the stream.
 */
export interface DoneEvent {
  type: 'done';
  fullText?: string;
}

/**
 * Discriminated union of all SSE stream event types.
 */
export type StreamEvent = TokenEvent | ErrorEvent | MetadataEvent | DoneEvent;

/**
 * All valid event type strings.
 */
export type StreamEventType = StreamEvent['type'];

// ─── Static Response (server → client) ──────────────────────

/**
 * Non-streaming response from the server.
 */
export interface LiveLLMResponse {
  content: string;
  model?: string;
  provider?: string;
  usage?: UsageInfo;
}

// ─── Action Feedback (client → server) ──────────────────────

/**
 * Payload sent back to the server when a user interacts with
 * an action component (choice, confirm, slider, etc.).
 */
export interface LiveLLMActionPayload {
  /** Component type: 'choice' | 'confirm' | 'slider' | 'rating-input' | etc. */
  component: string;
  /** Action performed: 'select' | 'confirm' | 'cancel' | 'submit' | 'change' */
  action: string;
  /** The user's selection, input, or value */
  value: any;
  /** Human-readable label for the action */
  label: string;
  /** Original question or context from the component */
  context?: string;
}

// ─── Chat Request (client → server) ─────────────────────────

/**
 * Standardized chat request shape.
 */
export interface LiveLLMChatRequest {
  /** The user's message (or empty string if action-only) */
  message: string;
  /** Conversation history */
  history?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** Attached action payload (when the message originates from a component interaction) */
  action?: LiveLLMActionPayload;
}

// ─── Type Guards ────────────────────────────────────────────

const VALID_EVENT_TYPES: readonly string[] = ['token', 'error', 'metadata', 'done'];

/**
 * Check if a value is a valid StreamEvent.
 */
export function isStreamEvent(value: unknown): value is StreamEvent {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.type !== 'string') return false;
  return VALID_EVENT_TYPES.includes(obj.type);
}

export function isTokenEvent(event: StreamEvent): event is TokenEvent {
  return event.type === 'token';
}

export function isErrorEvent(event: StreamEvent): event is ErrorEvent {
  return event.type === 'error';
}

export function isMetadataEvent(event: StreamEvent): event is MetadataEvent {
  return event.type === 'metadata';
}

export function isDoneEvent(event: StreamEvent): event is DoneEvent {
  return event.type === 'done';
}
