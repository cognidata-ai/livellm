// ═══════════════════════════════════════════════════════════════
// LiveLLM Type Definitions
// ═══════════════════════════════════════════════════════════════

// ─── Configuration ───────────────────────────────────────────

export type TransformerMode = 'auto' | 'passive' | 'off';
export type ThemeName = 'default' | 'dark' | 'minimal' | 'custom';
export type ComponentCategory = 'block' | 'inline' | 'action';

export interface TransformerConfig {
  mode: TransformerMode;
  detectors: 'all' | string[];
  confidenceThreshold: number;
}

export interface MarkdownConfig {
  gfm: boolean;
  breaks: boolean;
  linkify: boolean;
  typographer: boolean;
}

export interface RendererConfig {
  shadowDom: boolean;
  sanitize: boolean;
  proseStyles: boolean;
}

export interface StreamingConfig {
  enabled: boolean;
  skeletonDelay: number;
  showCursor: boolean;
  autoScroll: boolean;
  cursorChar: string;
}

export interface ActionsConfig {
  onAction: (action: LiveLLMAction) => void;
  autoSend: boolean;
  showPreview: boolean;
  labelTemplates: Record<string, (...args: any[]) => string>;
}

export interface SecurityConfig {
  enableCodeRunner: boolean;
  allowedOrigins: string[];
  maxJsonSize: number;
}

export interface LiveLLMConfig {
  theme: ThemeName;
  locale: string;
  debug: boolean;
  components: 'all' | 'core' | string[];
  lazyLoad: boolean;
  transformer: TransformerConfig;
  markdown: MarkdownConfig;
  renderer: RendererConfig;
  streaming: StreamingConfig;
  actions: ActionsConfig;
  security: SecurityConfig;
  themeVars: Record<string, string>;
}

// ─── Actions ─────────────────────────────────────────────────

export interface LiveLLMAction {
  type: 'livellm:action';
  component: string;
  action: string;
  value: any;
  label: string;
  metadata: {
    componentId: string;
    timestamp: number;
    questionContext?: string;
  };
}

// ─── Registry ────────────────────────────────────────────────

export type SchemaPropertyType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';

export interface SchemaProperty {
  type: SchemaPropertyType;
  required?: boolean;
  default?: any;
  min?: number;
  max?: number;
  enum?: string[];
  items?: SchemaProperty;
}

export interface ComponentSchema {
  [key: string]: SchemaProperty;
}

export interface SkeletonConfig {
  html: string;
  height: string;
}

export interface ComponentRegistration {
  name: string;
  tagName: string;
  component: CustomElementConstructor | null;
  schema: ComponentSchema;
  skeleton: SkeletonConfig;
  category: ComponentCategory;
  lazy: boolean;
  moduleUrl: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  prop: string;
  expected?: string;
  received?: string;
  message: string;
}

// ─── Parser / AST ────────────────────────────────────────────

export interface ASTNode {
  type: string;
  children?: ASTNode[];
  value?: string;
  raw?: string;
  position?: {
    start: { line: number };
    end: { line: number };
  };
}

export interface LiveLLMComponentNode extends ASTNode {
  type: 'livellm-component';
  component: string;
  props: Record<string, any>;
  raw: string;
}

export interface LiveLLMInlineNode extends ASTNode {
  type: 'livellm-inline';
  component: string;
  props: Record<string, any>;
  raw: string;
}

// ─── Transformer ─────────────────────────────────────────────

export interface DetectionMatch {
  start: number;
  end: number;
  data: Record<string, any>;
  confidence: number;
  apply: () => void;
}

export interface DetectorDefinition {
  detect: (markdown: string) => DetectionMatch[];
  transform: (match: DetectionMatch) => string;
}

export interface Detection {
  type: string;
  position: { start: number; end: number };
  confidence: number;
  apply: () => void;
}

// ─── Events ──────────────────────────────────────────────────

export type EventHandler = (...args: any[]) => void;

export interface EventMap {
  [eventName: string]: EventHandler[];
}

// ─── Streaming ───────────────────────────────────────────────

export type StreamState =
  | 'IDLE'
  | 'DETECTING'
  | 'BUFFERING'
  | 'PARSING'
  | 'RENDERING'
  | 'INTERACTIVE'
  | 'ERROR';

export interface StreamRendererOptions {
  tokenDelay: number;
  skeletonDelay: number;
  transformOnComplete: boolean;
  transformDuringStream: boolean;
  autoScroll: boolean;
  showCursor: boolean;
  cursorChar: string;
  onStart?: () => void;
  onToken?: (token: string) => void;
  onComponentStart?: (type: string) => void;
  onComponentComplete?: (type: string, props: Record<string, any>) => void;
  onEnd?: (fullText: string) => void;
  onError?: (error: Error) => void;
}
