import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMCodeRunner, CODE_RUNNER_REGISTRATION } from '../../src/components/block/code-runner';

const tagName = 'livellm-test-code-runner';
try { customElements.define(tagName, LiveLLMCodeRunner); } catch {}

function createCodeRunner(props: Record<string, any>): LiveLLMCodeRunner {
  const el = document.createElement(tagName) as LiveLLMCodeRunner;
  el.setAttribute('data-livellm', 'code-runner');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Code Runner Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(CODE_RUNNER_REGISTRATION.schema.code).toBeDefined();
    expect(CODE_RUNNER_REGISTRATION.schema.code.required).toBe(true);
    expect(CODE_RUNNER_REGISTRATION.category).toBe('block');
  });

  it('should render code content', () => {
    const el = createCodeRunner({
      code: 'const x = 42;\nconsole.log(x);',
      language: 'javascript',
    });
    const shadow = el.shadowRoot!;
    const codeEl = shadow.querySelector('.cr-code');
    expect(codeEl?.textContent).toContain('const x = 42;');
  });

  it('should display language label', () => {
    const el = createCodeRunner({
      code: 'print("hello")',
      language: 'python',
    });
    const shadow = el.shadowRoot!;
    const lang = shadow.querySelector('.cr-lang');
    expect(lang?.textContent?.toLowerCase()).toContain('python');
  });

  it('should render copy button when copyable', () => {
    const el = createCodeRunner({
      code: 'console.log("hi")',
      copyable: true,
    });
    const shadow = el.shadowRoot!;
    const copyBtn = shadow.querySelector('.cr-btn.copy');
    expect(copyBtn).toBeTruthy();
  });

  it('should not render copy button when copyable is false', () => {
    const el = createCodeRunner({
      code: 'console.log("hi")',
      copyable: false,
    });
    const shadow = el.shadowRoot!;
    const copyBtn = shadow.querySelector('.cr-btn.copy');
    expect(copyBtn).toBeFalsy();
  });

  it('should render run button when runnable', () => {
    const el = createCodeRunner({
      code: 'console.log("hi")',
      language: 'javascript',
      runnable: true,
    });
    const shadow = el.shadowRoot!;
    const runBtn = shadow.querySelector('.cr-btn.run');
    expect(runBtn).toBeTruthy();
  });

  it('should render line numbers when showLineNumbers is true', () => {
    const el = createCodeRunner({
      code: 'line1\nline2\nline3',
      showLineNumbers: true,
    });
    const shadow = el.shadowRoot!;
    const codeEl = shadow.querySelector('.cr-code');
    expect(codeEl?.classList.contains('show-lines')).toBe(true);
  });

  it('should render code lines as spans', () => {
    const el = createCodeRunner({
      code: 'a\nb\nc',
    });
    const shadow = el.shadowRoot!;
    const lines = shadow.querySelectorAll('.cr-line');
    expect(lines.length).toBe(3);
  });
});
