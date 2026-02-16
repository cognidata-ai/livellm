import { describe, it, expect } from 'vitest';
import {
  isStreamEvent,
  isTokenEvent,
  isErrorEvent,
  isMetadataEvent,
  isDoneEvent,
} from '../../src/protocol/types';
import type { StreamEvent } from '../../src/protocol/types';

describe('Type Guards', () => {
  // ─── isStreamEvent ────────────────────────────────────────

  describe('isStreamEvent', () => {
    it('should return true for token events', () => {
      expect(isStreamEvent({ type: 'token', token: 'hi' })).toBe(true);
    });

    it('should return true for error events', () => {
      expect(
        isStreamEvent({ type: 'error', code: 'timeout', message: 'err', recoverable: false })
      ).toBe(true);
    });

    it('should return true for metadata events', () => {
      expect(isStreamEvent({ type: 'metadata', model: 'test' })).toBe(true);
    });

    it('should return true for done events', () => {
      expect(isStreamEvent({ type: 'done' })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isStreamEvent(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isStreamEvent(undefined)).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isStreamEvent('token')).toBe(false);
      expect(isStreamEvent(42)).toBe(false);
      expect(isStreamEvent(true)).toBe(false);
    });

    it('should return false for objects without type', () => {
      expect(isStreamEvent({ token: 'hi' })).toBe(false);
    });

    it('should return false for objects with non-string type', () => {
      expect(isStreamEvent({ type: 123 })).toBe(false);
    });

    it('should return false for unknown type strings', () => {
      expect(isStreamEvent({ type: 'unknown' })).toBe(false);
      expect(isStreamEvent({ type: 'stream' })).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isStreamEvent([{ type: 'token' }])).toBe(false);
    });
  });

  // ─── Specific type guards ────────────────────────────────

  describe('isTokenEvent', () => {
    it('should return true for token events', () => {
      const event: StreamEvent = { type: 'token', token: 'hi' };
      expect(isTokenEvent(event)).toBe(true);
    });

    it('should return false for other events', () => {
      const event: StreamEvent = { type: 'done' };
      expect(isTokenEvent(event)).toBe(false);
    });
  });

  describe('isErrorEvent', () => {
    it('should return true for error events', () => {
      const event: StreamEvent = { type: 'error', code: 'timeout', message: 'err', recoverable: false };
      expect(isErrorEvent(event)).toBe(true);
    });

    it('should return false for other events', () => {
      const event: StreamEvent = { type: 'token', token: 'hi' };
      expect(isErrorEvent(event)).toBe(false);
    });
  });

  describe('isMetadataEvent', () => {
    it('should return true for metadata events', () => {
      const event: StreamEvent = { type: 'metadata', model: 'test' };
      expect(isMetadataEvent(event)).toBe(true);
    });

    it('should return false for other events', () => {
      const event: StreamEvent = { type: 'done' };
      expect(isMetadataEvent(event)).toBe(false);
    });
  });

  describe('isDoneEvent', () => {
    it('should return true for done events', () => {
      const event: StreamEvent = { type: 'done' };
      expect(isDoneEvent(event)).toBe(true);
    });

    it('should return true for done events with fullText', () => {
      const event: StreamEvent = { type: 'done', fullText: 'Hello' };
      expect(isDoneEvent(event)).toBe(true);
    });

    it('should return false for other events', () => {
      const event: StreamEvent = { type: 'token', token: 'hi' };
      expect(isDoneEvent(event)).toBe(false);
    });
  });
});
