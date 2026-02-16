import type { LiveLLMConfig } from '../utils/types';
/**
 * Default configuration for LiveLLM.
 */
export declare const DEFAULT_CONFIG: LiveLLMConfig;
/**
 * Deep merge two config objects. Source overrides target.
 */
export declare function mergeConfig(target: LiveLLMConfig, source: Partial<LiveLLMConfig>): LiveLLMConfig;
