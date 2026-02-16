import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const CODE_RUNNER_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .cr-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    overflow: hidden;
  }
  .cr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  .cr-lang {
    font-size: 12px;
    font-weight: 600;
    color: var(--livellm-text-secondary, #6c757d);
    text-transform: uppercase;
  }
  .cr-actions {
    display: flex;
    gap: 6px;
  }
  .cr-btn {
    padding: 4px 10px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: 4px;
    background: var(--livellm-bg-component, #ffffff);
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    transition: var(--livellm-transition, 0.2s ease);
  }
  .cr-btn:hover {
    border-color: var(--livellm-primary, #6c5ce7);
    color: var(--livellm-primary, #6c5ce7);
  }
  .cr-btn.run {
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    border-color: var(--livellm-primary, #6c5ce7);
  }
  .cr-btn.run:hover { opacity: 0.9; }
  .cr-btn.copied {
    background: var(--livellm-success, #00b894);
    color: #fff;
    border-color: var(--livellm-success, #00b894);
  }
  .cr-code {
    padding: 14px 16px;
    margin: 0;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Fira Code', monospace;
    font-size: 13px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre;
    background: #1e1e2e;
    color: #cdd6f4;
    counter-reset: line;
  }
  .cr-code.show-lines {
    padding-left: 50px;
    position: relative;
  }
  .cr-line {
    display: block;
  }
  .cr-code.show-lines .cr-line::before {
    counter-increment: line;
    content: counter(line);
    position: absolute;
    left: 14px;
    width: 24px;
    text-align: right;
    color: #585b70;
    font-size: 12px;
  }
  .cr-output {
    border-top: 1px solid var(--livellm-border, #e0e0e0);
    padding: 12px 16px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 13px;
    line-height: 1.5;
    background: var(--livellm-bg-secondary, #f8f9fa);
    white-space: pre-wrap;
    max-height: 200px;
    overflow: auto;
  }
  .cr-output-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--livellm-text-secondary, #6c757d);
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .cr-output-error { color: #e74c3c; }
`;

export class LiveLLMCodeRunner extends LiveLLMComponent {
  private output: string = '';
  private hasError: boolean = false;

  render(): void {
    const code: string = this._props.code || '';
    const language: string = this._props.language || '';
    const showLineNumbers: boolean = this._props.showLineNumbers ?? true;
    const copyable: boolean = this._props.copyable ?? true;
    const runnable: boolean = this._props.runnable ?? false;

    this.setStyles(CODE_RUNNER_STYLES);

    const lines = code.split('\n').map(l =>
      `<span class="cr-line">${this.escapeHtml(l)}</span>`
    ).join('\n');

    const outputHtml = this.output ? `
      <div class="cr-output">
        <div class="cr-output-header">Output</div>
        <div class="${this.hasError ? 'cr-output-error' : ''}">${this.escapeHtml(this.output)}</div>
      </div>
    ` : '';

    this.setContent(`
      <div class="cr-container">
        <div class="cr-header">
          <span class="cr-lang">${this.escapeHtml(language)}</span>
          <div class="cr-actions">
            ${copyable ? '<button class="cr-btn copy">\uD83D\uDCCB Copy</button>' : ''}
            ${runnable ? '<button class="cr-btn run">\u25B6 Run</button>' : ''}
          </div>
        </div>
        <pre class="cr-code${showLineNumbers ? ' show-lines' : ''}">${lines}</pre>
        ${outputHtml}
      </div>
    `);

    if (copyable) {
      this.shadowRoot?.querySelector('.cr-btn.copy')?.addEventListener('click', (e) => {
        this.copyCode(code, e.currentTarget as HTMLElement);
      });
    }

    if (runnable) {
      this.shadowRoot?.querySelector('.cr-btn.run')?.addEventListener('click', () => {
        this.runCode(code, language);
      });
    }
  }

  private copyCode(code: string, btn: HTMLElement): void {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(code);
      }
      btn.textContent = '\u2713 Copied';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '\uD83D\uDCCB Copy';
        btn.classList.remove('copied');
      }, 2000);
    } catch {}

    this.emitAction('code-copy', {
      value: code,
      label: 'Copied code to clipboard',
    });
  }

  private runCode(code: string, language: string): void {
    if (['javascript', 'js'].includes(language.toLowerCase())) {
      try {
        const logs: string[] = [];
        const mockConsole = {
          log: (...args: any[]) => logs.push(args.map(String).join(' ')),
          error: (...args: any[]) => logs.push('Error: ' + args.map(String).join(' ')),
          warn: (...args: any[]) => logs.push('Warning: ' + args.map(String).join(' ')),
        };
        const fn = new Function('console', code);
        const result = fn(mockConsole);
        if (result !== undefined) logs.push(String(result));
        this.output = logs.join('\n') || 'No output';
        this.hasError = false;
      } catch (e: any) {
        this.output = e.message || String(e);
        this.hasError = true;
      }
      this.render();
    }

    this.emitAction('code-run', {
      value: code,
      label: `Ran ${language} code`,
      language,
    });
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const CODE_RUNNER_REGISTRATION: RegisterOptions = {
  schema: {
    code: { type: 'string', required: true },
    language: { type: 'string', default: '' },
    showLineNumbers: { type: 'boolean', default: true },
    copyable: { type: 'boolean', default: true },
    runnable: { type: 'boolean', default: false },
  },
  category: 'block',
  skeleton: {
    html: '<div style="height:150px;border-radius:8px;background:#1e1e2e;"></div>',
    height: '150px',
  },
};
