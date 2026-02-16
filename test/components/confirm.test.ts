import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveLLMConfirm } from '../../src/components/action/confirm';

const tagName = 'livellm-test-confirm';
try { customElements.define(tagName, LiveLLMConfirm); } catch {}

function createConfirm(props: Record<string, any> = {}): LiveLLMConfirm {
  const el = document.createElement(tagName) as LiveLLMConfirm;
  el.setAttribute('data-livellm', 'confirm');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Confirm Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should render with default text', () => {
    const el = createConfirm();
    expect(el.shadowRoot!.querySelector('.confirm-text')?.textContent).toContain('Are you sure?');
  });

  it('should render custom text and button labels', () => {
    const el = createConfirm({
      text: 'Deploy to production?',
      confirmLabel: 'Deploy',
      cancelLabel: 'Abort',
    });

    expect(el.shadowRoot!.querySelector('.confirm-text')?.textContent).toContain('Deploy to production?');
    expect(el.shadowRoot!.querySelector('.confirm-btn.primary')?.textContent).toContain('Deploy');
    expect(el.shadowRoot!.querySelector('.confirm-btn.secondary')?.textContent).toContain('Abort');
  });

  it('should emit confirmed action on confirm click', () => {
    const el = createConfirm({ text: 'Continue?' });
    const handler = vi.fn();
    el.addEventListener('livellm:action', (e) => handler((e as CustomEvent).detail));

    const confirmBtn = el.shadowRoot!.querySelector('[data-action="confirm"]') as HTMLElement;
    confirmBtn.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].data.confirmed).toBe(true);
    expect(handler.mock.calls[0][0].data.value).toBe(true);
  });

  it('should emit declined action on cancel click', () => {
    const el = createConfirm({ text: 'Continue?' });
    const handler = vi.fn();
    el.addEventListener('livellm:action', (e) => handler((e as CustomEvent).detail));

    const cancelBtn = el.shadowRoot!.querySelector('[data-action="cancel"]') as HTMLElement;
    cancelBtn.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].data.confirmed).toBe(false);
  });

  it('should disable buttons after answering', () => {
    const el = createConfirm();
    const confirmBtn = el.shadowRoot!.querySelector('[data-action="confirm"]') as HTMLElement;
    confirmBtn.click();

    const disabled = el.shadowRoot!.querySelectorAll('.confirm-btn.disabled');
    expect(disabled.length).toBe(2);
  });

  it('should show result text after answering', () => {
    const el = createConfirm({ confirmLabel: 'Yes, do it' });
    const confirmBtn = el.shadowRoot!.querySelector('[data-action="confirm"]') as HTMLElement;
    confirmBtn.click();

    const result = el.shadowRoot!.querySelector('.confirm-result');
    expect(result?.textContent).toContain('Yes, do it');
  });
});
