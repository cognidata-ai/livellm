/**
 * Safe JSON parsing with size limits and error handling.
 */
export function safeParseJSON(
  jsonStr: string,
  maxSize: number = 50000
): { valid: boolean; data: any; error?: string } {
  // Check size limit
  if (jsonStr.length > maxSize) {
    return {
      valid: false,
      data: null,
      error: `JSON exceeds maximum size of ${maxSize} bytes (got ${jsonStr.length})`,
    };
  }

  try {
    const data = JSON.parse(jsonStr);
    return { valid: true, data };
  } catch (e) {
    return {
      valid: false,
      data: null,
      error: `Invalid JSON: ${(e as Error).message}`,
    };
  }
}

/**
 * Extracts the component type and JSON string from a livellm code fence content.
 * Returns null if the format doesn't match.
 */
export function parseLiveLLMBlock(info: string, content: string): {
  type: string;
  json: string;
  props: Record<string, any>;
} | null {
  const trimmedInfo = info.trim();

  if (!trimmedInfo.startsWith('livellm:')) {
    return null;
  }

  const type = trimmedInfo.substring('livellm:'.length).trim();
  if (!type || !/^[\w][\w-]*$/.test(type)) {
    return null;
  }

  const jsonStr = content.trim();
  const parsed = safeParseJSON(jsonStr);

  if (!parsed.valid) {
    return null;
  }

  return {
    type,
    json: jsonStr,
    props: parsed.data,
  };
}

/**
 * Parses an inline livellm component from code text.
 * Format: livellm:componentType{"prop": "value"}
 */
export function parseLiveLLMInline(text: string): {
  type: string;
  props: Record<string, any>;
} | null {
  const match = text.match(/^livellm:([\w][\w-]*)(\{.*\})$/s);
  if (!match) return null;

  const type = match[1];
  const jsonStr = match[2];
  const parsed = safeParseJSON(jsonStr);

  if (!parsed.valid) return null;

  return {
    type,
    props: parsed.data,
  };
}
