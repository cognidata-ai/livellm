import MarkdownIt from 'markdown-it';
import type { EventBus } from './events';
import type { Registry } from './registry';
import type { MarkdownConfig } from '../utils/types';
import { parseLiveLLMBlock, parseLiveLLMInline, safeParseJSON } from '../utils/json';

/**
 * @livellm/parser — Markdown parser with LiveLLM component support.
 * Extends markdown-it to detect livellm: code fences and inline code.
 */
export class Parser {
  private md: MarkdownIt;
  private events: EventBus;
  private registry: Registry;

  constructor(events: EventBus, registry: Registry, config: Partial<MarkdownConfig> = {}) {
    this.events = events;
    this.registry = registry;

    this.md = new MarkdownIt({
      html: false, // We sanitize separately
      xhtmlOut: false,
      breaks: config.breaks ?? true,
      linkify: config.linkify ?? true,
      typographer: config.typographer ?? true,
    });

    // Enable GFM tables if configured
    if (config.gfm !== false) {
      // markdown-it includes GFM tables by default
    }

    // Install the LiveLLM plugin
    this.md.use(this.livellmPlugin.bind(this));
  }

  /**
   * Parse markdown string to HTML with LiveLLM components.
   */
  parse(markdown: string): string {
    this.events.emit('parser:start');
    const result = this.md.render(markdown);
    this.events.emit('parser:complete', result);
    return result;
  }

  /**
   * Get the markdown-it instance for advanced configuration.
   */
  getMarkdownIt(): MarkdownIt {
    return this.md;
  }

  /**
   * markdown-it plugin that handles livellm: code fences and inline code.
   */
  private livellmPlugin(md: MarkdownIt): void {
    // Override fence renderer for livellm: blocks
    const defaultFence = md.renderer.rules.fence;

    md.renderer.rules.fence = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const info = token.info.trim();

      if (info.startsWith('livellm:')) {
        return this.renderLiveLLMBlock(info, token.content);
      }

      // Default fence rendering
      if (defaultFence) {
        return defaultFence(tokens, idx, options, env, self);
      }
      return self.renderToken(tokens, idx, options);
    };

    // Override code_inline renderer for livellm: inline components
    const defaultCodeInline = md.renderer.rules.code_inline;

    md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const content = token.content;

      if (content.startsWith('livellm:')) {
        return this.renderLiveLLMInline(content);
      }

      // Default code inline rendering
      if (defaultCodeInline) {
        return defaultCodeInline(tokens, idx, options, env, self);
      }
      return `<code>${md.utils.escapeHtml(content)}</code>`;
    };
  }

  /**
   * Render a livellm: code fence block as a Web Component placeholder.
   */
  private renderLiveLLMBlock(info: string, content: string): string {
    const parsed = parseLiveLLMBlock(info, content);

    if (!parsed) {
      this.events.emit('parser:error', new Error(`Failed to parse livellm block: ${info}`));
      return this.renderFallback(info, content, 'Invalid livellm block format');
    }

    const { type, json, props } = parsed;

    this.events.emit('parser:component:found', type, json);

    // Check if component is registered
    if (!this.registry.has(type)) {
      this.events.emit('component:unknown', type);
      return this.renderFallback(`livellm:${type}`, content, null);
    }

    // Validate props
    const validation = this.registry.validate(type, props);
    if (!validation.valid) {
      this.events.emit('registry:validation:failed', type, validation.errors);
      return this.renderError(type, content, validation.errors);
    }

    // Apply defaults
    const finalProps = this.registry.applyDefaults(type, props);
    const registration = this.registry.get(type)!;

    // Return the Web Component HTML
    const escapedProps = this.escapeAttr(JSON.stringify(finalProps));
    return (
      `<${registration.tagName} ` +
      `data-livellm="${type}" ` +
      `data-props="${escapedProps}">` +
      `</${registration.tagName}>\n`
    );
  }

  /**
   * Render a livellm: inline code as an inline Web Component.
   */
  private renderLiveLLMInline(content: string): string {
    const parsed = parseLiveLLMInline(content);

    if (!parsed) {
      return `<code>${this.escapeHtml(content)}</code>`;
    }

    const { type, props } = parsed;

    if (!this.registry.has(type)) {
      this.events.emit('component:unknown', type);
      return `<code>${this.escapeHtml(content)}</code>`;
    }

    const validation = this.registry.validate(type, props);
    if (!validation.valid) {
      this.events.emit('registry:validation:failed', type, validation.errors);
      return `<code>${this.escapeHtml(content)}</code>`;
    }

    const finalProps = this.registry.applyDefaults(type, props);
    const registration = this.registry.get(type)!;
    const escapedProps = this.escapeAttr(JSON.stringify(finalProps));

    return (
      `<${registration.tagName} ` +
      `data-livellm="${type}" ` +
      `data-props="${escapedProps}">` +
      `</${registration.tagName}>`
    );
  }

  /**
   * Render a fallback code block when the component is unknown or format is invalid.
   */
  private renderFallback(info: string, content: string, error: string | null): string {
    const escapedInfo = this.escapeHtml(info);
    const escapedContent = this.escapeHtml(content.trim());
    let html = `<div class="livellm-fallback">`;
    if (error) {
      html += `<div class="livellm-fallback-error">${this.escapeHtml(error)}</div>`;
    }
    html += `<pre><code class="language-${escapedInfo}">${escapedContent}</code></pre>`;
    html += `</div>\n`;
    return html;
  }

  /**
   * Render an error display when props are invalid.
   */
  private renderError(
    type: string,
    content: string,
    errors: Array<{ prop: string; message: string }>
  ): string {
    const errorList = errors.map((e) => `<li>${this.escapeHtml(e.message)}</li>`).join('');
    return (
      `<div class="livellm-error">` +
      `<div class="livellm-error-header">Component "${this.escapeHtml(type)}" — validation errors:</div>` +
      `<ul class="livellm-error-list">${errorList}</ul>` +
      `<pre><code>${this.escapeHtml(content.trim())}</code></pre>` +
      `</div>\n`
    );
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escapeAttr(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
