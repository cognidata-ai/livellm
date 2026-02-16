/**
 * Safe JSON parsing with size limits and error handling.
 */
export declare function safeParseJSON(jsonStr: string, maxSize?: number): {
    valid: boolean;
    data: any;
    error?: string;
};
/**
 * Extracts the component type and JSON string from a livellm code fence content.
 * Returns null if the format doesn't match.
 */
export declare function parseLiveLLMBlock(info: string, content: string): {
    type: string;
    json: string;
    props: Record<string, any>;
} | null;
/**
 * Parses an inline livellm component from code text.
 * Format: livellm:componentType{"prop": "value"}
 */
export declare function parseLiveLLMInline(text: string): {
    type: string;
    props: Record<string, any>;
} | null;
