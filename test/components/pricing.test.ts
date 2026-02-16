import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMPricing, PRICING_REGISTRATION } from '../../src/components/block/pricing';

const tagName = 'livellm-test-pricing';
try { customElements.define(tagName, LiveLLMPricing); } catch {}

function createPricing(props: Record<string, any>): LiveLLMPricing {
  const el = document.createElement(tagName) as LiveLLMPricing;
  el.setAttribute('data-livellm', 'pricing');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Pricing Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(PRICING_REGISTRATION.schema.tiers).toBeDefined();
    expect(PRICING_REGISTRATION.schema.tiers.type).toBe('array');
    expect(PRICING_REGISTRATION.category).toBe('block');
  });

  it('should render pricing tiers', () => {
    const el = createPricing({
      tiers: [
        { name: 'Free', price: '$0', period: '/mo', features: ['1 user', '5GB'] },
        { name: 'Pro', price: '$29', period: '/mo', features: ['Unlimited users', '100GB'], highlighted: true },
        { name: 'Enterprise', price: 'Custom', features: ['Everything'] },
      ],
    });
    const shadow = el.shadowRoot!;
    const cards = shadow.querySelectorAll('.pricing-card');
    expect(cards.length).toBe(3);
  });

  it('should highlight the recommended tier', () => {
    const el = createPricing({
      tiers: [
        { name: 'Basic', price: '$9', features: ['Feature 1'] },
        { name: 'Pro', price: '$29', features: ['Feature 1', 'Feature 2'], highlighted: true },
      ],
    });
    const shadow = el.shadowRoot!;
    const cards = shadow.querySelectorAll('.pricing-card');
    expect(cards[1].classList.contains('highlighted')).toBe(true);
  });

  it('should render feature lists', () => {
    const el = createPricing({
      tiers: [
        { name: 'Plan', price: '$10', features: ['Feature A', 'Feature B', 'Feature C'] },
      ],
    });
    const shadow = el.shadowRoot!;
    const features = shadow.querySelectorAll('.pricing-feature');
    expect(features.length).toBe(3);
    expect(features[0].textContent).toContain('Feature A');
  });

  it('should render CTA buttons', () => {
    const el = createPricing({
      tiers: [
        { name: 'Pro', price: '$29', features: ['Feature 1'], cta: 'Get Started' },
      ],
    });
    const shadow = el.shadowRoot!;
    const btn = shadow.querySelector('.pricing-btn');
    expect(btn?.textContent).toContain('Get Started');
  });

  it('should emit pricing-select action on CTA click', () => {
    const el = createPricing({
      tiers: [
        { name: 'Pro', price: '$29', features: ['Feature 1'], cta: 'Select' },
      ],
    });
    const shadow = el.shadowRoot!;
    let actionDetail: any = null;
    el.addEventListener('livellm:action', (e: Event) => {
      actionDetail = (e as CustomEvent).detail;
    });
    const btn = shadow.querySelector('.pricing-btn') as HTMLElement;
    btn?.click();
    expect(actionDetail).toBeTruthy();
    expect(actionDetail.action).toBe('pricing-select');
  });
});
