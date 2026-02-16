import { describe, it, expect } from 'vitest';
import { validateProps, applyDefaults } from '../../src/utils/validate';
import { safeParseJSON, parseLiveLLMBlock, parseLiveLLMInline } from '../../src/utils/json';

describe('validateProps', () => {
  it('should pass valid props', () => {
    const result = validateProps(
      {
        name: { type: 'string', required: true },
        age: { type: 'number', min: 0, max: 150 },
        active: { type: 'boolean' },
      },
      { name: 'John', age: 30, active: true }
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail on missing required field', () => {
    const result = validateProps(
      { name: { type: 'string', required: true } },
      {}
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0].prop).toBe('name');
  });

  it('should fail on wrong type', () => {
    const result = validateProps(
      { age: { type: 'number' } },
      { age: 'not-a-number' }
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0].expected).toBe('number');
  });

  it('should validate number range', () => {
    const schema = { value: { type: 'number' as const, min: 0, max: 100 } };

    expect(validateProps(schema, { value: -1 }).valid).toBe(false);
    expect(validateProps(schema, { value: 101 }).valid).toBe(false);
    expect(validateProps(schema, { value: 50 }).valid).toBe(true);
  });

  it('should validate enum values', () => {
    const schema = { color: { type: 'enum' as const, enum: ['red', 'green', 'blue'] } };

    expect(validateProps(schema, { color: 'red' }).valid).toBe(true);
    expect(validateProps(schema, { color: 'purple' }).valid).toBe(false);
  });

  it('should validate arrays', () => {
    const schema = { items: { type: 'array' as const } };

    expect(validateProps(schema, { items: [1, 2, 3] }).valid).toBe(true);
    expect(validateProps(schema, { items: 'not-array' }).valid).toBe(false);
  });

  it('should validate objects', () => {
    const schema = { data: { type: 'object' as const } };

    expect(validateProps(schema, { data: { key: 'val' } }).valid).toBe(true);
    expect(validateProps(schema, { data: [1, 2] }).valid).toBe(false);
    expect(validateProps(schema, { data: 'string' }).valid).toBe(false);
  });

  it('should validate booleans', () => {
    const schema = { active: { type: 'boolean' as const } };

    expect(validateProps(schema, { active: true }).valid).toBe(true);
    expect(validateProps(schema, { active: 'yes' }).valid).toBe(false);
  });

  it('should skip optional undefined fields', () => {
    const schema = {
      name: { type: 'string' as const, required: true },
      color: { type: 'string' as const },
    };

    const result = validateProps(schema, { name: 'test' });
    expect(result.valid).toBe(true);
  });
});

describe('applyDefaults', () => {
  it('should fill in defaults for missing props', () => {
    const result = applyDefaults(
      {
        color: { type: 'string', default: 'blue' },
        size: { type: 'number', default: 14 },
      },
      {}
    );

    expect(result.color).toBe('blue');
    expect(result.size).toBe(14);
  });

  it('should not override existing values', () => {
    const result = applyDefaults(
      { color: { type: 'string', default: 'blue' } },
      { color: 'red' }
    );

    expect(result.color).toBe('red');
  });
});

describe('safeParseJSON', () => {
  it('should parse valid JSON', () => {
    const result = safeParseJSON('{"key": "value"}');
    expect(result.valid).toBe(true);
    expect(result.data.key).toBe('value');
  });

  it('should reject invalid JSON', () => {
    const result = safeParseJSON('{invalid}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid JSON');
  });

  it('should reject oversized JSON', () => {
    const big = JSON.stringify({ data: 'x'.repeat(1000) });
    const result = safeParseJSON(big, 100);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum size');
  });
});

describe('parseLiveLLMBlock', () => {
  it('should parse a valid livellm block', () => {
    const result = parseLiveLLMBlock('livellm:alert', '{"type":"info","text":"Hi"}');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('alert');
    expect(result!.props.text).toBe('Hi');
  });

  it('should return null for non-livellm info', () => {
    const result = parseLiveLLMBlock('javascript', 'console.log("hi")');
    expect(result).toBeNull();
  });

  it('should return null for invalid JSON content', () => {
    const result = parseLiveLLMBlock('livellm:alert', '{bad json}');
    expect(result).toBeNull();
  });

  it('should return null for invalid component name', () => {
    const result = parseLiveLLMBlock('livellm:', '{"test":1}');
    expect(result).toBeNull();
  });
});

describe('parseLiveLLMInline', () => {
  it('should parse a valid inline component', () => {
    const result = parseLiveLLMInline('livellm:badge{"text":"Active","color":"green"}');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('badge');
    expect(result!.props.text).toBe('Active');
  });

  it('should return null for non-livellm code', () => {
    const result = parseLiveLLMInline('console.log("hi")');
    expect(result).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    const result = parseLiveLLMInline('livellm:badge{invalid}');
    expect(result).toBeNull();
  });
});
