/**
 * DOM utility functions for LiveLLM renderer.
 */

/**
 * Resolve a container from a string selector or HTMLElement.
 */
export function resolveContainer(
  target: string | HTMLElement
): HTMLElement | null {
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  return target;
}

/**
 * Generate a unique component instance ID.
 */
let idCounter = 0;
export function generateComponentId(type: string): string {
  return `livellm-${type}-${++idCounter}-${Date.now().toString(36)}`;
}

/**
 * Scroll an element's parent to make it visible.
 */
export function scrollToBottom(container: HTMLElement): void {
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

/**
 * Create an element with attributes and optional children.
 */
export function createElement(
  tag: string,
  attrs?: Record<string, string>,
  children?: (Node | string)[]
): HTMLElement {
  const el = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
  }

  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    }
  }

  return el;
}
