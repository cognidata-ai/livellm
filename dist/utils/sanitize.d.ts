/**
 * HTML sanitization for LiveLLM.
 * Lightweight sanitizer that removes dangerous elements and attributes.
 * For production, consider integrating DOMPurify.
 */
/**
 * Sanitize an HTML string by removing dangerous tags and attributes.
 */
export declare function sanitizeHTML(html: string): string;
