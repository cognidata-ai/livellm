import type { ComponentRegistration, ComponentSchema, ComponentCategory, SkeletonConfig, ValidationResult } from '../utils/types';
import { EventBus } from './events';
export interface RegisterOptions {
    schema?: ComponentSchema;
    skeleton?: SkeletonConfig;
    category?: ComponentCategory;
    lazy?: boolean;
    moduleUrl?: string | null;
}
/**
 * @livellm/registry — Component registry.
 * Manages the catalog of available components, validation, and lazy loading.
 */
export declare class Registry {
    private components;
    private events;
    constructor(events: EventBus);
    /**
     * Register a component.
     */
    register(name: string, component: CustomElementConstructor | null, options?: RegisterOptions): void;
    /**
     * Check if a component is registered.
     */
    has(name: string): boolean;
    /**
     * Get a component registration.
     */
    get(name: string): ComponentRegistration | undefined;
    /**
     * List all registered component names.
     */
    list(): string[];
    /**
     * Remove a component from the registry.
     */
    remove(name: string): boolean;
    /**
     * Validate props against a component's schema.
     */
    validate(name: string, props: Record<string, any>): ValidationResult;
    /**
     * Apply defaults from schema and return completed props.
     */
    applyDefaults(name: string, props: Record<string, any>): Record<string, any>;
    /**
     * Get the skeleton config for a component.
     */
    getSkeleton(name: string): SkeletonConfig;
    /**
     * Lazy-load a component by URL.
     */
    loadComponent(name: string): Promise<boolean>;
    /**
     * Clear all registrations.
     */
    clear(): void;
}
