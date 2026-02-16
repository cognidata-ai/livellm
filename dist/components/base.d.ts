/**
 * LiveLLMComponent — Base class for all LiveLLM Web Components.
 * All built-in and custom components should extend this class.
 */
export declare abstract class LiveLLMComponent extends HTMLElement {
    protected _props: Record<string, any>;
    private _componentId;
    constructor();
    static get observedAttributes(): string[];
    attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    /**
     * Get the component's props.
     */
    get props(): Record<string, any>;
    /**
     * Get the component's unique instance ID.
     */
    get componentId(): string;
    /**
     * Emit a LiveLLM action event that bubbles through Shadow DOM.
     */
    protected emitAction(action: string, data: Record<string, any>): void;
    /**
     * Access a CSS custom property from the theme.
     */
    protected getThemeVar(name: string, fallback?: string): string;
    /**
     * Inject styles into the Shadow DOM.
     */
    protected setStyles(css: string): void;
    /**
     * Set the Shadow DOM content (HTML string).
     */
    protected setContent(html: string): void;
    /**
     * Abstract: Render the component for the first time.
     */
    abstract render(): void;
    /**
     * Update the component when props change.
     * Default implementation re-renders.
     */
    update(): void;
    private _generateId;
}
