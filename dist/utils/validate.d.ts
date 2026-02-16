import type { ComponentSchema, ValidationResult } from './types';
/**
 * Schema validation engine for component props.
 * Validates props against a ComponentSchema definition.
 */
export declare function validateProps(schema: ComponentSchema, props: Record<string, any>): ValidationResult;
/**
 * Apply defaults from schema to props.
 * Returns a new object with defaults filled in for missing optional props.
 */
export declare function applyDefaults(schema: ComponentSchema, props: Record<string, any>): Record<string, any>;
