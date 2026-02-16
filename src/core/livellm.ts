import type {
  LiveLLMConfig,
  LiveLLMAction,
  EventHandler,
  StreamRendererOptions,
  DetectorDefinition,
  ComponentSchema,
  ComponentCategory,
  SkeletonConfig,
} from '../utils/types';
import { DEFAULT_CONFIG, mergeConfig } from './config';
import { EventBus } from './events';
import { Registry, RegisterOptions } from './registry';
import { Parser } from './parser';
import { Renderer } from './renderer';
import { Transformer } from './transformer';
import { Actions } from './actions';
import { StreamRenderer } from './stream-renderer';
import { Observer, ObserverOptions } from './observer';

/**
 * LiveLLM — Main facade class.
 * Orchestrates all modules and provides the public API.
 */
export class LiveLLMInstance {
  private config: LiveLLMConfig;
  private events: EventBus;
  private _registry: Registry;
  private parser: Parser;
  private _renderer: Renderer;
  private _transformer: Transformer;
  private actions: Actions;
  private _observer: Observer;
  private initialized: boolean = false;

  readonly version: string = '0.1.0';

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.events = new EventBus();
    this._registry = new Registry(this.events);
    this.parser = new Parser(this.events, this._registry, this.config.markdown);
    this._renderer = new Renderer(this.events, this._registry, this.parser, this.config.renderer);
    this._transformer = new Transformer(this.events, this.config.transformer);
    this._transformer.registerBuiltIns();
    this.actions = new Actions(this.events, this.config.actions);
    this._observer = new Observer(this.events, this._registry, this.parser, this._renderer);
  }

  /**
   * Initialize LiveLLM with configuration.
   */
  init(userConfig: Partial<LiveLLMConfig> = {}): void {
    this.config = mergeConfig(DEFAULT_CONFIG, userConfig);
    this.events.setDebug(this.config.debug);

    // Reinitialize modules with updated config, preserving the existing registry
    // (built-in components are registered on the singleton at import time)
    this.parser = new Parser(this.events, this._registry, this.config.markdown);
    this._renderer = new Renderer(
      this.events,
      this._registry,
      this.parser,
      this.config.renderer
    );
    this._transformer = new Transformer(this.events, this.config.transformer);
    this._transformer.registerBuiltIns();
    this.actions = new Actions(this.events, this.config.actions);
    this._observer = new Observer(this.events, this._registry, this.parser, this._renderer);

    this.initialized = true;
  }

  // ═══ Rendering ═══════════════════════════════════════════

  /**
   * Render markdown into a container element.
   */
  render(markdown: string, target: string | HTMLElement): HTMLElement | null {
    const enriched =
      this.config.transformer.mode !== 'off'
        ? this._transformer.transform(markdown)
        : markdown;

    return this._renderer.render(enriched, target);
  }

  /**
   * Render markdown to an HTML string.
   */
  renderToString(markdown: string): string {
    const enriched =
      this.config.transformer.mode !== 'off'
        ? this._transformer.transform(markdown)
        : markdown;

    return this._renderer.renderToString(enriched);
  }

  // ═══ Streaming ═══════════════════════════════════════════

  /**
   * Create a stream renderer for token-by-token rendering.
   */
  createStreamRenderer(
    target: string | HTMLElement,
    options: Partial<StreamRendererOptions> = {}
  ): StreamRenderer {
    return new StreamRenderer(
      this.events,
      this._registry,
      this.parser,
      this._renderer,
      target,
      options
    );
  }

  // ═══ Transformer ════════════════════════════════════════

  /**
   * Transform raw markdown by detecting and enriching patterns.
   */
  transform(markdown: string): string {
    return this._transformer.transform(markdown);
  }

  /**
   * Access the transformer for advanced configuration.
   */
  get transformer(): Transformer {
    return this._transformer;
  }

  // ═══ Registry ═══════════════════════════════════════════

  /**
   * Register a component.
   */
  register(
    name: string,
    component: CustomElementConstructor | null,
    options: RegisterOptions = {}
  ): void {
    this._registry.register(name, component, options);
  }

  /**
   * Access the registry for advanced operations.
   */
  get registry(): Registry {
    return this._registry;
  }

  // ═══ Events ═════════════════════════════════════════════

  /**
   * Listen to an event.
   */
  on(event: string, handler: EventHandler): void {
    this.events.on(event, handler);
  }

  /**
   * Remove an event listener.
   */
  off(event: string, handler: EventHandler): void {
    this.events.off(event, handler);
  }

  /**
   * Listen to an event once.
   */
  once(event: string, handler: EventHandler): void {
    this.events.once(event, handler);
  }

  // ═══ Observer ═════════════════════════════════════════

  /**
   * Start observing a container for dynamic livellm: blocks.
   */
  observe(options: ObserverOptions): void {
    this._observer.observe(options);
  }

  /**
   * Stop observing.
   */
  disconnect(): void {
    this._observer.disconnect();
  }

  /**
   * Access the observer instance.
   */
  get observer(): Observer {
    return this._observer;
  }

  // ═══ Lifecycle ══════════════════════════════════════════

  /**
   * Destroy the LiveLLM instance and clean up.
   */
  destroy(): void {
    this._observer.disconnect();
    this.events.removeAll();
    this._registry.clear();
    this.initialized = false;
  }

  /**
   * Reset to initial state with default config.
   */
  reset(): void {
    this.destroy();
    this.config = { ...DEFAULT_CONFIG };
    this.events = new EventBus();
    this._registry = new Registry(this.events);
    this.parser = new Parser(this.events, this._registry, this.config.markdown);
    this._renderer = new Renderer(this.events, this._registry, this.parser, this.config.renderer);
    this._transformer = new Transformer(this.events, this.config.transformer);
    this._transformer.registerBuiltIns();
    this.actions = new Actions(this.events, this.config.actions);
    this._observer = new Observer(this.events, this._registry, this.parser, this._renderer);
  }
}
