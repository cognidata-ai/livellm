import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMSteps, STEPS_REGISTRATION } from '../../src/components/block/steps';

const tagName = 'livellm-test-steps';
try { customElements.define(tagName, LiveLLMSteps); } catch {}

function createSteps(props: Record<string, any>): LiveLLMSteps {
  const el = document.createElement(tagName) as LiveLLMSteps;
  el.setAttribute('data-livellm', 'steps');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Steps Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(STEPS_REGISTRATION.schema.steps).toBeDefined();
    expect(STEPS_REGISTRATION.schema.steps.type).toBe('array');
    expect(STEPS_REGISTRATION.category).toBe('block');
  });

  it('should render steps with labels', () => {
    const el = createSteps({
      steps: [
        { label: 'Step One', description: 'First step' },
        { label: 'Step Two', description: 'Second step' },
        { label: 'Step Three', description: 'Third step' },
      ],
      current: 1,
    });
    const shadow = el.shadowRoot!;
    const labels = shadow.querySelectorAll('.step-label');
    expect(labels.length).toBe(3);
    expect(labels[0].textContent).toContain('Step One');
    expect(labels[1].textContent).toContain('Step Two');
  });

  it('should mark completed steps', () => {
    const el = createSteps({
      steps: [
        { label: 'Done' },
        { label: 'Active' },
        { label: 'Pending' },
      ],
      current: 1,
    });
    const shadow = el.shadowRoot!;
    const items = shadow.querySelectorAll('.step');
    expect(items[0].classList.contains('completed')).toBe(true);
    expect(items[1].classList.contains('active')).toBe(true);
    expect(items[2].classList.contains('completed')).toBe(false);
    expect(items[2].classList.contains('active')).toBe(false);
  });

  it('should render title when provided', () => {
    const el = createSteps({
      title: 'My Process',
      steps: [{ label: 'One' }],
    });
    const shadow = el.shadowRoot!;
    const title = shadow.querySelector('.steps-title');
    expect(title?.textContent).toContain('My Process');
  });

  it('should default current to -1 (none active)', () => {
    const el = createSteps({
      steps: [{ label: 'First' }, { label: 'Second' }],
    });
    const shadow = el.shadowRoot!;
    const items = shadow.querySelectorAll('.step');
    expect(items[0].classList.contains('active')).toBe(false);
    expect(items[1].classList.contains('active')).toBe(false);
  });

  it('should render description text', () => {
    const el = createSteps({
      steps: [{ label: 'Setup', description: 'Install dependencies' }],
    });
    const shadow = el.shadowRoot!;
    const desc = shadow.querySelector('.step-description');
    expect(desc?.textContent).toContain('Install dependencies');
  });
});
