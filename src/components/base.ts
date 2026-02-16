/**
 * LiveLLMComponent — Base class for all LiveLLM Web Components.
 * All built-in and custom components should extend this class.
 */
export abstract class LiveLLMComponent extends HTMLElement {
  protected _props: Record<string, any> = {};
  private _componentId: string = '';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes(): string[] {
    return ['data-props', 'data-livellm'];
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (name === 'data-props' && newVal) {
      try {
        this._props = JSON.parse(newVal);
        if (this.isConnected) {
          this.update();
        }
      } catch {
        console.error('[LiveLLM] Invalid JSON in data-props:', newVal);
      }
    }
  }

  connectedCallback(): void {
    const propsAttr = this.getAttribute('data-props');
    if (propsAttr) {
      try {
        this._props = JSON.parse(propsAttr);
      } catch {
        console.error('[LiveLLM] Invalid JSON in data-props');
      }
    }
    this._componentId =
      this.getAttribute('data-component-id') || this._generateId();
    this.render();
  }

  disconnectedCallback(): void {
    // Override in subclasses for cleanup
  }

  /**
   * Get the component's props.
   */
  get props(): Record<string, any> {
    return this._props;
  }

  /**
   * Get the component's unique instance ID.
   */
  get componentId(): string {
    return this._componentId;
  }

  /**
   * Emit a LiveLLM action event that bubbles through Shadow DOM.
   */
  protected emitAction(action: string, data: Record<string, any>): void {
    this.dispatchEvent(
      new CustomEvent('livellm:action', {
        bubbles: true,
        composed: true, // Traverses Shadow DOM boundary
        detail: {
          component: this.getAttribute('data-livellm') || '',
          action,
          data,
          timestamp: Date.now(),
          componentId: this._componentId,
        },
      })
    );
  }

  /**
   * Access a CSS custom property from the theme.
   */
  protected getThemeVar(name: string, fallback: string = ''): string {
    return (
      getComputedStyle(this)
        .getPropertyValue(`--livellm-${name}`)
        .trim() || fallback
    );
  }

  /**
   * Inject styles into the Shadow DOM.
   */
  protected setStyles(css: string): void {
    if (!this.shadowRoot) return;
    let styleEl = this.shadowRoot.querySelector('style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      this.shadowRoot.prepend(styleEl);
    }
    styleEl.textContent = css;
  }

  /**
   * Set the Shadow DOM content (HTML string).
   */
  protected setContent(html: string): void {
    if (!this.shadowRoot) return;

    // Preserve <style> element if it exists
    const styleEl = this.shadowRoot.querySelector('style');
    const styleText = styleEl?.textContent || '';

    this.shadowRoot.innerHTML = '';

    if (styleText) {
      const newStyle = document.createElement('style');
      newStyle.textContent = styleText;
      this.shadowRoot.appendChild(newStyle);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'livellm-component';
    wrapper.innerHTML = html;
    this.shadowRoot.appendChild(wrapper);
  }

  /**
   * Abstract: Render the component for the first time.
   */
  abstract render(): void;

  /**
   * Update the component when props change.
   * Default implementation re-renders.
   */
  update(): void {
    this.render();
  }

  private _generateId(): string {
    const type = this.getAttribute('data-livellm') || 'component';
    return `livellm-${type}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  }
}
