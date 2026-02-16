/**
 * HTML sanitization for LiveLLM.
 * Lightweight sanitizer that removes dangerous elements and attributes.
 * For production, consider integrating DOMPurify.
 */

const DANGEROUS_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'form', 'input',
  'textarea', 'select', 'button', 'link', 'meta', 'style',
  'base', 'applet',
]);

const DANGEROUS_ATTRS = new Set([
  'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus',
  'onblur', 'onsubmit', 'onreset', 'onchange', 'oninput',
  'onkeydown', 'onkeyup', 'onkeypress', 'onmousedown',
  'onmouseup', 'onmousemove', 'onmouseout', 'oncontextmenu',
  'ondblclick', 'ondrag', 'ondrop', 'onscroll',
]);

/**
 * Sanitize an HTML string by removing dangerous tags and attributes.
 */
export function sanitizeHTML(html: string): string {
  // Create a temporary document to parse the HTML
  if (typeof DOMParser === 'undefined') {
    // Server-side: basic regex sanitization
    return stripDangerousTagsRegex(html);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  sanitizeNode(doc.body);

  return doc.body.innerHTML;
}

function sanitizeNode(node: Node): void {
  const toRemove: Node[] = [];

  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];

    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tagName = el.tagName.toLowerCase();

      if (DANGEROUS_TAGS.has(tagName)) {
        toRemove.push(child);
        continue;
      }

      // Remove dangerous attributes
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        if (
          DANGEROUS_ATTRS.has(name) ||
          name.startsWith('on') ||
          attr.value.trim().toLowerCase().startsWith('javascript:')
        ) {
          el.removeAttribute(attr.name);
        }
      }

      // Recursively sanitize children
      sanitizeNode(child);
    }
  }

  for (const node of toRemove) {
    node.parentNode?.removeChild(node);
  }
}

function stripDangerousTagsRegex(html: string): string {
  let sanitized = html;
  for (const tag of DANGEROUS_TAGS) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');
    const selfClosing = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    sanitized = sanitized.replace(selfClosing, '');
  }
  // Remove on* attributes
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');
  return sanitized;
}
