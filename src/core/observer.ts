import type { EventBus } from './events';
import type { Registry } from './registry';
import type { Parser } from './parser';
import type { Renderer } from './renderer';

/**
 * @livellm/observer — MutationObserver-based observe mode.
 * Watches DOM containers for new text content and automatically
 * renders livellm: blocks when detected.
 */
export interface ObserverOptions {
  /** CSS selector or element to observe */
  target: string | HTMLElement;
  /** Whether to observe child list changes */
  childList?: boolean;
  /** Whether to observe character data changes */
  characterData?: boolean;
  /** Whether to observe subtree */
  subtree?: boolean;
  /** Debounce delay in ms before processing mutations */
  debounce?: number;
}

export class Observer {
  private events: EventBus;
  private registry: Registry;
  private parser: Parser;
  private renderer: Renderer;
  private observer: MutationObserver | null = null;
  private target: HTMLElement | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private options: Required<Omit<ObserverOptions, 'target'>> = {
    childList: true,
    characterData: true,
    subtree: true,
    debounce: 100,
  };

  constructor(
    events: EventBus,
    registry: Registry,
    parser: Parser,
    renderer: Renderer
  ) {
    this.events = events;
    this.registry = registry;
    this.parser = parser;
    this.renderer = renderer;
  }

  /**
   * Start observing a target element for livellm: blocks.
   */
  observe(options: ObserverOptions): void {
    if (typeof MutationObserver === 'undefined') {
      console.warn('[LiveLLM Observer] MutationObserver not available');
      return;
    }

    // Resolve target element
    if (typeof options.target === 'string') {
      this.target = document.querySelector(options.target) as HTMLElement;
    } else {
      this.target = options.target;
    }

    if (!this.target) {
      console.error('[LiveLLM Observer] Target element not found');
      return;
    }

    // Merge options
    if (options.childList !== undefined) this.options.childList = options.childList;
    if (options.characterData !== undefined) this.options.characterData = options.characterData;
    if (options.subtree !== undefined) this.options.subtree = options.subtree;
    if (options.debounce !== undefined) this.options.debounce = options.debounce;

    // Stop any existing observer
    this.disconnect();

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(this.target, {
      childList: this.options.childList,
      characterData: this.options.characterData,
      subtree: this.options.subtree,
    });

    this.events.emit('observer:started', this.target);

    // Initial scan
    this.scanTarget();
  }

  /**
   * Stop observing.
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      this.events.emit('observer:stopped');
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Check if currently observing.
   */
  get isObserving(): boolean {
    return this.observer !== null;
  }

  /**
   * Handle incoming mutations with debouncing.
   */
  private handleMutations(_mutations: MutationRecord[]): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.scanTarget();
    }, this.options.debounce);
  }

  /**
   * Scan the target element for unprocessed livellm: code blocks.
   */
  private scanTarget(): void {
    if (!this.target) return;

    // Find all <code> elements that contain livellm: blocks and haven't been processed
    const codeBlocks = this.target.querySelectorAll('code:not([data-livellm-processed])');
    let processed = 0;

    codeBlocks.forEach((codeEl) => {
      const text = codeEl.textContent || '';

      // Check if this is a livellm: block pattern
      if (text.startsWith('livellm:')) {
        const preEl = codeEl.parentElement;
        if (preEl && preEl.tagName === 'PRE') {
          this.processCodeBlock(preEl, text);
          codeEl.setAttribute('data-livellm-processed', 'true');
          processed++;
        }
      }
    });

    if (processed > 0) {
      this.events.emit('observer:processed', processed);
    }
  }

  /**
   * Process a single code block — parse and replace with component.
   */
  private processCodeBlock(preEl: HTMLElement, rawText: string): void {
    // Parse "livellm:componentName\n{json}" format
    const newlineIdx = rawText.indexOf('\n');
    if (newlineIdx === -1) return;

    const header = rawText.substring(0, newlineIdx).trim();
    const componentName = header.replace('livellm:', '').trim();
    const jsonStr = rawText.substring(newlineIdx + 1).trim();

    if (!componentName || !this.registry.has(componentName)) return;

    try {
      const props = JSON.parse(jsonStr);
      const registration = this.registry.get(componentName);
      if (!registration) return;

      // Create the web component element
      const tagName = registration.tagName;
      const componentEl = document.createElement(tagName);
      componentEl.setAttribute('data-livellm', componentName);
      componentEl.setAttribute('data-props', JSON.stringify(props));

      // Replace the <pre> with the component
      preEl.replaceWith(componentEl);

      this.events.emit('observer:component-rendered', { name: componentName, props });
    } catch (err) {
      console.error(`[LiveLLM Observer] Failed to process ${componentName}:`, err);
    }
  }
}
