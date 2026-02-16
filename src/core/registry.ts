import type {
  ComponentRegistration,
  ComponentSchema,
  ComponentCategory,
  SkeletonConfig,
  ValidationResult,
} from '../utils/types';
import { validateProps, applyDefaults } from '../utils/validate';
import { EventBus } from './events';

export interface RegisterOptions {
  schema?: ComponentSchema;
  skeleton?: SkeletonConfig;
  category?: ComponentCategory;
  lazy?: boolean;
  moduleUrl?: string | null;
}

const DEFAULT_SKELETON: SkeletonConfig = {
  html: '<div class="livellm-skeleton"><div class="shimmer"></div></div>',
  height: '100px',
};

/**
 * @livellm/registry — Component registry.
 * Manages the catalog of available components, validation, and lazy loading.
 */
export class Registry {
  private components: Map<string, ComponentRegistration> = new Map();
  private events: EventBus;

  constructor(events: EventBus) {
    this.events = events;
  }

  /**
   * Register a component.
   */
  register(
    name: string,
    component: CustomElementConstructor | null,
    options: RegisterOptions = {}
  ): void {
    const tagName = `livellm-${name}`;
    const registration: ComponentRegistration = {
      name,
      tagName,
      component,
      schema: options.schema || {},
      skeleton: options.skeleton || DEFAULT_SKELETON,
      category: options.category || 'block',
      lazy: options.lazy ?? (component === null),
      moduleUrl: options.moduleUrl || null,
    };

    this.components.set(name, registration);

    // Register the Custom Element if component class is provided and not already defined
    if (component && typeof customElements !== 'undefined') {
      if (!customElements.get(tagName)) {
        try {
          customElements.define(tagName, component);
        } catch (err) {
          console.error(`[LiveLLM Registry] Failed to define custom element <${tagName}>:`, err);
        }
      }
    }

    this.events.emit('registry:registered', name, registration);
  }

  /**
   * Check if a component is registered.
   */
  has(name: string): boolean {
    return this.components.has(name);
  }

  /**
   * Get a component registration.
   */
  get(name: string): ComponentRegistration | undefined {
    return this.components.get(name);
  }

  /**
   * List all registered component names.
   */
  list(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Remove a component from the registry.
   */
  remove(name: string): boolean {
    const existed = this.components.delete(name);
    if (existed) {
      this.events.emit('registry:removed', name);
    }
    return existed;
  }

  /**
   * Validate props against a component's schema.
   */
  validate(name: string, props: Record<string, any>): ValidationResult {
    const registration = this.components.get(name);
    if (!registration) {
      return {
        valid: false,
        errors: [{ prop: '_component', message: `Component "${name}" is not registered` }],
      };
    }

    return validateProps(registration.schema, props);
  }

  /**
   * Apply defaults from schema and return completed props.
   */
  applyDefaults(name: string, props: Record<string, any>): Record<string, any> {
    const registration = this.components.get(name);
    if (!registration) return props;
    return applyDefaults(registration.schema, props);
  }

  /**
   * Get the skeleton config for a component.
   */
  getSkeleton(name: string): SkeletonConfig {
    const registration = this.components.get(name);
    return registration?.skeleton || DEFAULT_SKELETON;
  }

  /**
   * Lazy-load a component by URL.
   */
  async loadComponent(name: string): Promise<boolean> {
    const registration = this.components.get(name);
    if (!registration) return false;
    if (!registration.lazy || registration.component) return true;
    if (!registration.moduleUrl) return false;

    this.events.emit('registry:lazy:loading', name, registration.moduleUrl);

    try {
      const module = await import(/* @vite-ignore */ registration.moduleUrl);
      const ComponentClass = module.default || module[`LiveLLM${capitalize(name)}`];

      if (!ComponentClass) {
        throw new Error(`Module does not export a component class for "${name}"`);
      }

      registration.component = ComponentClass;
      registration.lazy = false;

      // Register the custom element
      const tagName = registration.tagName;
      if (typeof customElements !== 'undefined' && !customElements.get(tagName)) {
        customElements.define(tagName, ComponentClass);
      }

      this.events.emit('registry:lazy:loaded', name);
      return true;
    } catch (err) {
      console.error(`[LiveLLM Registry] Failed to lazy-load "${name}":`, err);
      return false;
    }
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.components.clear();
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
