import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveLLMInstance } from '../../src/core/livellm';

// Mock components for testing
class MockAlert extends HTMLElement {
  connectedCallback() {
    const props = JSON.parse(this.getAttribute('data-props') || '{}');
    this.innerHTML = `<div class="alert">${props.text || ''}</div>`;
  }
}

class MockBadge extends HTMLElement {
  connectedCallback() {
    const props = JSON.parse(this.getAttribute('data-props') || '{}');
    this.innerHTML = `<span class="badge">${props.text || ''}</span>`;
  }
}

class MockTabs extends HTMLElement {
  connectedCallback() {
    this.innerHTML = '<div class="tabs">tabs</div>';
  }
}

describe('Full Pipeline Integration', () => {
  let livellm: LiveLLMInstance;

  beforeEach(() => {
    livellm = new LiveLLMInstance();
    livellm.init({ transformer: { mode: 'off', detectors: 'all', confidenceThreshold: 0.7 } });

    livellm.register('alert', MockAlert, {
      schema: {
        type: { type: 'enum', enum: ['info', 'success', 'warning', 'error'], default: 'info' },
        text: { type: 'string', required: true },
      },
      category: 'inline',
    });

    livellm.register('badge', MockBadge, {
      schema: {
        text: { type: 'string', required: true },
        color: { type: 'enum', enum: ['green', 'red', 'blue', 'yellow'], default: 'blue' },
      },
      category: 'inline',
    });

    livellm.register('tabs', MockTabs, {
      schema: {
        tabs: { type: 'array', required: true },
        defaultTab: { type: 'number', default: 0 },
      },
      category: 'block',
    });
  });

  it('should render standard markdown without components', () => {
    const container = document.createElement('div');
    livellm.render('# Hello World\n\nA paragraph with **bold** text.', container);

    expect(container.innerHTML).toContain('Hello World');
    expect(container.innerHTML).toContain('<strong>bold</strong>');
  });

  it('should render markdown with livellm block component', () => {
    const container = document.createElement('div');
    const md = `# Servicios

\`\`\`livellm:alert
{"type": "success", "text": "Operación completada"}
\`\`\`

Texto después del componente.`;

    livellm.render(md, container);

    expect(container.innerHTML).toContain('Servicios');
    expect(container.innerHTML).toContain('livellm-alert');
    expect(container.innerHTML).toContain('Texto después del componente');
  });

  it('should render inline livellm components', () => {
    const container = document.createElement('div');
    const md = 'El estado es `livellm:badge{"text":"Activo","color":"green"}` ahora.';

    livellm.render(md, container);
    expect(container.innerHTML).toContain('livellm-badge');
  });

  it('should render fallback for unknown components', () => {
    const container = document.createElement('div');
    const md = '```livellm:unknown\n{"key":"value"}\n```';

    livellm.render(md, container);

    expect(container.innerHTML).toContain('livellm-fallback');
    expect(container.innerHTML).not.toContain('<livellm-unknown');
  });

  it('should render error for invalid props', () => {
    const container = document.createElement('div');
    const md = '```livellm:alert\n{"type":"info"}\n```';

    livellm.render(md, container);

    // text is required but missing
    expect(container.innerHTML).toContain('livellm-error');
  });

  it('should renderToString produce valid HTML', () => {
    const html = livellm.renderToString('# Title\n\n```livellm:alert\n{"type":"info","text":"Test"}\n```');

    expect(html).toContain('Title');
    expect(html).toContain('livellm-alert');
    expect(typeof html).toBe('string');
  });

  it('should support event listeners', () => {
    const handler = vi.fn();
    livellm.on('parser:start', handler);

    const container = document.createElement('div');
    livellm.render('Hello', container);

    expect(handler).toHaveBeenCalled();
  });

  it('should handle mixed content with multiple components', () => {
    const container = document.createElement('div');
    const md = `# Dashboard

Estado: \`livellm:badge{"text":"Online","color":"green"}\`

\`\`\`livellm:alert
{"type": "info", "text": "Bienvenido al sistema"}
\`\`\`

\`\`\`livellm:tabs
{"tabs":[{"label":"Tab1","content":"Content 1"},{"label":"Tab2","content":"Content 2"}]}
\`\`\`

Fin del dashboard.`;

    livellm.render(md, container);

    expect(container.innerHTML).toContain('Dashboard');
    expect(container.innerHTML).toContain('livellm-badge');
    expect(container.innerHTML).toContain('livellm-alert');
    expect(container.innerHTML).toContain('livellm-tabs');
    expect(container.innerHTML).toContain('Fin del dashboard');
  });

  it('should capture actions from components', () => {
    const onAction = vi.fn();
    livellm.on('action:triggered', onAction);

    const container = document.createElement('div');
    livellm.render('Hello', container);

    // Simulate a component action
    const event = new CustomEvent('livellm:action', {
      bubbles: true,
      composed: true,
      detail: {
        component: 'alert',
        action: 'dismiss',
        data: { value: true },
        timestamp: Date.now(),
        componentId: 'test-123',
      },
    });
    container.dispatchEvent(event);

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'livellm:action',
      component: 'alert',
      action: 'dismiss',
    }));
  });

  it('should destroy and clean up', () => {
    const handler = vi.fn();
    livellm.on('parser:start', handler);

    livellm.destroy();

    const container = document.createElement('div');
    // After destroy, the instance is cleared but shouldn't crash
    expect(livellm.registry.list()).toHaveLength(0);
  });

  it('should reset to initial state', () => {
    livellm.register('custom', MockAlert, {
      schema: { text: { type: 'string', required: true } },
    });

    expect(livellm.registry.has('custom')).toBe(true);

    livellm.reset();

    expect(livellm.registry.has('custom')).toBe(false);
    expect(livellm.registry.list()).toHaveLength(0);
  });

  it('should report version', () => {
    expect(livellm.version).toBe('0.1.0');
  });
});
