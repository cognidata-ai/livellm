import type { LiveLLMConfig } from '../utils/types';

/**
 * Default configuration for LiveLLM.
 */
export const DEFAULT_CONFIG: LiveLLMConfig = {
  theme: 'default',
  locale: 'en',
  debug: false,
  components: 'all',
  lazyLoad: true,

  transformer: {
    mode: 'auto',
    detectors: 'all',
    confidenceThreshold: 0.7,
  },

  markdown: {
    gfm: true,
    breaks: true,
    linkify: true,
    typographer: true,
  },

  renderer: {
    shadowDom: true,
    sanitize: true,
    proseStyles: true,
  },

  streaming: {
    enabled: true,
    skeletonDelay: 200,
    showCursor: true,
    autoScroll: true,
    cursorChar: '▊',
  },

  actions: {
    onAction: () => {},
    autoSend: false,
    showPreview: true,
    labelTemplates: {},
  },

  security: {
    enableCodeRunner: false,
    allowedOrigins: ['*'],
    maxJsonSize: 50000,
  },

  themeVars: {},
};

/**
 * Deep merge two config objects. Source overrides target.
 */
export function mergeConfig(
  target: LiveLLMConfig,
  source: Partial<LiveLLMConfig>
): LiveLLMConfig {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof LiveLLMConfig)[]) {
    const val = source[key];
    if (val === undefined) continue;

    if (
      typeof val === 'object' &&
      val !== null &&
      !Array.isArray(val) &&
      typeof (result as any)[key] === 'object'
    ) {
      (result as any)[key] = { ...(result as any)[key], ...val };
    } else {
      (result as any)[key] = val;
    }
  }

  return result;
}
