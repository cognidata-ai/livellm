import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const PRICING_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .pricing-container {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding: 4px;
  }
  .pricing-card {
    flex: 1;
    min-width: 200px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    overflow: hidden;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .pricing-card.highlighted {
    border-color: var(--livellm-primary, #6c5ce7);
    transform: scale(1.02);
    box-shadow: 0 4px 16px rgba(108, 92, 231, 0.15);
  }
  .pricing-badge {
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    text-align: center;
    padding: 4px 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .pricing-header {
    padding: 20px 16px 0;
    text-align: center;
  }
  .pricing-name {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .pricing-price {
    font-size: 32px;
    font-weight: 800;
    color: var(--livellm-primary, #6c5ce7);
  }
  .pricing-price .currency { font-size: 18px; vertical-align: top; }
  .pricing-period {
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-bottom: 16px;
  }
  .pricing-features {
    padding: 0 16px 16px;
    list-style: none;
    margin: 0;
  }
  .pricing-feature {
    padding: 6px 0;
    font-size: 13px;
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pricing-feature:last-child { border-bottom: none; }
  .pricing-check { color: var(--livellm-success, #00b894); }
  .pricing-cta {
    padding: 0 16px 20px;
    text-align: center;
  }
  .pricing-btn {
    display: inline-block;
    padding: 10px 24px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    transition: var(--livellm-transition, 0.2s ease);
    background: var(--livellm-bg-secondary, #f8f9fa);
    color: var(--livellm-text, #1a1a1a);
    width: 100%;
  }
  .pricing-card.highlighted .pricing-btn {
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
  }
  .pricing-btn:hover { opacity: 0.9; transform: translateY(-1px); }
`;

interface PricingTier {
  name: string;
  price: string | number;
  currency?: string;
  period?: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  cta?: string;
}

export class LiveLLMPricing extends LiveLLMComponent {
  render(): void {
    const rawTiers = this._props.tiers || this._props.plans || this._props.items || this._props.pricing || [];
    const tiers: PricingTier[] = Array.isArray(rawTiers)
      ? rawTiers.map((t: any) => this.normalizeTier(t))
      : [];

    this.setStyles(PRICING_STYLES);

    const cardsHtml = tiers.map((tier, i) => {
      const currency = tier.currency || '$';
      const period = tier.period || '/month';
      const highlighted = tier.highlighted ?? false;
      const cta = tier.cta || 'Select';

      const featuresHtml = (tier.features || []).map(f =>
        `<li class="pricing-feature"><span class="pricing-check">\u2713</span>${this.escapeHtml(f)}</li>`
      ).join('');

      return `
        <div class="pricing-card${highlighted ? ' highlighted' : ''}">
          ${tier.badge ? `<div class="pricing-badge">${this.escapeHtml(tier.badge)}</div>` : ''}
          <div class="pricing-header">
            <div class="pricing-name">${this.escapeHtml(tier.name)}</div>
            <div class="pricing-price"><span class="currency">${this.escapeHtml(currency)}</span>${this.escapeHtml(String(tier.price))}</div>
            <div class="pricing-period">${this.escapeHtml(period)}</div>
          </div>
          <ul class="pricing-features">${featuresHtml}</ul>
          <div class="pricing-cta">
            <button class="pricing-btn" data-tier="${i}">${this.escapeHtml(cta)}</button>
          </div>
        </div>
      `;
    }).join('');

    this.setContent(`<div class="pricing-container">${cardsHtml}</div>`);

    this.shadowRoot?.querySelectorAll('.pricing-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-tier') || '0', 10);
        const tier = tiers[idx];
        if (tier) {
          this.emitAction('pricing-select', {
            value: tier.name,
            label: `Selected plan: ${tier.name}`,
            tier,
          });
        }
      });
    });
  }

  private normalizeTier(tier: any): PricingTier {
    if (!tier || typeof tier !== 'object') {
      return { name: String(tier ?? ''), price: 0, features: [] };
    }
    const rawFeatures = tier.features || tier.items || tier.perks || tier.benefits || [];
    return {
      name: String(tier.name ?? tier.title ?? tier.label ?? tier.plan ?? ''),
      price: tier.price ?? tier.cost ?? tier.amount ?? 0,
      currency: tier.currency,
      period: tier.period ?? tier.billing ?? tier.interval,
      features: Array.isArray(rawFeatures) ? rawFeatures.map((f: any) => String(f ?? '')) : [],
      highlighted: tier.highlighted ?? tier.recommended ?? tier.popular ?? false,
      badge: tier.badge ?? tier.tag,
      cta: tier.cta ?? tier.button ?? tier.action,
    };
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const PRICING_REGISTRATION: RegisterOptions = {
  schema: {
    tiers: { type: 'array' },
    plans: { type: 'array' },
    items: { type: 'array' },
    pricing: { type: 'array' },
  },
  category: 'block',
  skeleton: {
    html: '<div style="height:300px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '300px',
  },
};
