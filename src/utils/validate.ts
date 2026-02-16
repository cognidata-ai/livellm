import type { ComponentSchema, SchemaProperty, ValidationResult, ValidationError } from './types';

/**
 * Schema validation engine for component props.
 * Validates props against a ComponentSchema definition.
 */
export function validateProps(
  schema: ComponentSchema,
  props: Record<string, any>
): ValidationResult {
  const errors: ValidationError[] = [];

  // Check required fields and validate types
  for (const [key, def] of Object.entries(schema)) {
    const value = props[key];

    // Check required
    if (def.required && (value === undefined || value === null)) {
      errors.push({
        prop: key,
        message: `${key} is required`,
      });
      continue;
    }

    // Skip validation if optional and not provided
    if (value === undefined || value === null) {
      continue;
    }

    // Validate type
    const typeError = validateType(key, value, def);
    if (typeError) {
      errors.push(typeError);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateType(
  key: string,
  value: any,
  def: SchemaProperty
): ValidationError | null {
  switch (def.type) {
    case 'string':
      if (typeof value !== 'string') {
        return {
          prop: key,
          expected: 'string',
          received: typeof value,
          message: `${key} must be a string`,
        };
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return {
          prop: key,
          expected: 'number',
          received: typeof value,
          message: `${key} must be a number`,
        };
      }
      if (def.min !== undefined && value < def.min) {
        return {
          prop: key,
          message: `${key} must be >= ${def.min}`,
        };
      }
      if (def.max !== undefined && value > def.max) {
        return {
          prop: key,
          message: `${key} must be <= ${def.max}`,
        };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return {
          prop: key,
          expected: 'boolean',
          received: typeof value,
          message: `${key} must be a boolean`,
        };
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return {
          prop: key,
          expected: 'array',
          received: typeof value,
          message: `${key} must be an array`,
        };
      }
      break;

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        return {
          prop: key,
          expected: 'object',
          received: Array.isArray(value) ? 'array' : typeof value,
          message: `${key} must be an object`,
        };
      }
      break;

    case 'enum':
      if (def.enum && !def.enum.includes(value)) {
        return {
          prop: key,
          expected: `one of: ${def.enum.join(', ')}`,
          received: String(value),
          message: `${key} must be one of: ${def.enum.join(', ')}`,
        };
      }
      break;
  }

  return null;
}

/**
 * Apply defaults from schema to props.
 * Returns a new object with defaults filled in for missing optional props.
 */
export function applyDefaults(
  schema: ComponentSchema,
  props: Record<string, any>
): Record<string, any> {
  const result = { ...props };

  for (const [key, def] of Object.entries(schema)) {
    if (result[key] === undefined && def.default !== undefined) {
      result[key] = def.default;
    }
  }

  return result;
}
