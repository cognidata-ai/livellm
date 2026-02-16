import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const MAP_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .map-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .map-frame {
    width: 100%;
    border: none;
    display: block;
  }
  .map-header {
    padding: 10px 16px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .map-icon { font-size: 16px; }
  .map-title {
    font-weight: 600;
    font-size: 13px;
  }
  .map-address {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
  }
  .map-footer {
    padding: 8px 16px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-top: 1px solid var(--livellm-border, #e0e0e0);
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .map-link {
    color: var(--livellm-primary, #6c5ce7);
    text-decoration: none;
    font-weight: 500;
  }
  .map-link:hover { text-decoration: underline; }
`;

export class LiveLLMMap extends LiveLLMComponent {
  render(): void {
    const lat = this._props.lat ?? 0;
    const lng = this._props.lng ?? 0;
    const zoom = this._props.zoom ?? 13;
    const title = this._props.title || '';
    const address = this._props.address || '';
    const height = this._props.height || '300px';

    // Use OpenStreetMap embed (no API key required)
    const bbox = this.calculateBbox(lat, lng, zoom);
    const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
    const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;

    this.setStyles(MAP_STYLES);

    let headerHtml = '';
    if (title || address) {
      headerHtml = `
        <div class="map-header">
          <span class="map-icon">📍</span>
          <div>
            ${title ? `<div class="map-title">${this.escapeHtml(title)}</div>` : ''}
            ${address ? `<div class="map-address">${this.escapeHtml(address)}</div>` : ''}
          </div>
        </div>`;
    }

    this.setContent(`
      <div class="map-container">
        ${headerHtml}
        <iframe class="map-frame"
          src="${this.escapeAttr(osmUrl)}"
          height="${height}"
          loading="lazy"
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin">
        </iframe>
        <div class="map-footer">
          <span>${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
          <a class="map-link" href="${this.escapeAttr(osmLink)}" target="_blank" rel="noopener noreferrer">
            Open in OpenStreetMap
          </a>
        </div>
      </div>
    `);

    // Emit action when clicking the map link
    this.shadowRoot?.querySelector('.map-link')?.addEventListener('click', () => {
      this.emitAction('open-map', {
        value: { lat, lng, title, address },
        label: title
          ? `Opened map for: ${title}`
          : `Opened map at ${lat}, ${lng}`,
      });
    });
  }

  private calculateBbox(lat: number, lng: number, zoom: number): string {
    const delta = 180 / Math.pow(2, zoom);
    return `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escapeAttr(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const MAP_REGISTRATION: RegisterOptions = {
  schema: {
    lat: { type: 'number', required: true },
    lng: { type: 'number', required: true },
    zoom: { type: 'number', default: 13, min: 1, max: 20 },
    title: { type: 'string', default: '' },
    address: { type: 'string', default: '' },
    height: { type: 'string', default: '300px' },
    markers: { type: 'array', default: [] },
  },
  category: 'block',
  skeleton: {
    html: '<div class="livellm-skeleton" style="height:300px;border-radius:8px;background:#d5e8d4;"><div class="shimmer"></div></div>',
    height: '300px',
  },
};
