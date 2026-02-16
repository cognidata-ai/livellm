import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const FORM_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .form-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    background: var(--livellm-bg-component, #ffffff);
  }
  .form-title {
    padding: 12px 16px;
    font-weight: 600;
    font-size: 15px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  .form-body { padding: 16px; }
  .field {
    margin-bottom: 14px;
  }
  .field:last-child { margin-bottom: 0; }
  .field-label {
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
    font-size: 13px;
    color: var(--livellm-text, #1a1a1a);
  }
  .field-label .required {
    color: var(--livellm-danger, #ff6b6b);
    margin-left: 2px;
  }
  input, select, textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    color: var(--livellm-text, #1a1a1a);
    background: var(--livellm-bg, #ffffff);
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  input:focus, select:focus, textarea:focus {
    border-color: var(--livellm-primary, #6c5ce7);
    box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.15);
  }
  textarea { resize: vertical; min-height: 60px; }
  .checkbox-field {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .checkbox-field input {
    width: auto;
  }
  .submit-btn {
    display: block;
    width: 100%;
    padding: 10px;
    margin-top: 16px;
    background: var(--livellm-primary, #6c5ce7);
    color: white;
    border: none;
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .submit-btn:hover { background: var(--livellm-primary-dark, #5a4bd1); }
  .submit-btn:active { transform: translateY(1px); }
`;

interface FormField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[];
  rows?: number;
  placeholder?: string;
}

export class LiveLLMForm extends LiveLLMComponent {
  render(): void {
    const title = this._props.title || '';
    const rawFields = this._props.fields || this._props.inputs || this._props.items || [];
    const fields: FormField[] = Array.isArray(rawFields) ? rawFields : [];
    const submitLabel = this._props.submitLabel || this._props.buttonText || this._props.submit || 'Submit';
    const prefill: Record<string, any> = this._props.prefill || this._props.defaults || this._props.values || {};

    this.setStyles(FORM_STYLES);

    const fieldsHtml = fields.map((f) => this.renderField(f, prefill[f.name])).join('');

    this.setContent(`
      <div class="form-container">
        ${title ? `<div class="form-title">${this.escapeHtml(title)}</div>` : ''}
        <div class="form-body">
          <form>
            ${fieldsHtml}
            <button type="submit" class="submit-btn">${this.escapeHtml(submitLabel)}</button>
          </form>
        </div>
      </div>
    `);

    this.shadowRoot?.querySelector('form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit(fields);
    });
  }

  private renderField(field: FormField, prefillValue?: any): string {
    const req = field.required ? '<span class="required">*</span>' : '';
    const label = `<label class="field-label">${this.escapeHtml(field.label)}${req}</label>`;
    const val = prefillValue !== undefined ? this.escapeAttr(String(prefillValue)) : '';
    const ph = field.placeholder ? `placeholder="${this.escapeAttr(field.placeholder)}"` : '';

    switch (field.type) {
      case 'textarea':
        return `<div class="field">${label}<textarea name="${this.escapeAttr(field.name)}" rows="${field.rows || 3}" ${field.required ? 'required' : ''} ${ph}>${this.escapeHtml(val)}</textarea></div>`;

      case 'select':
        const opts = (field.options || []).map((o) => {
          const sel = o === val ? ' selected' : '';
          return `<option value="${this.escapeAttr(o)}"${sel}>${this.escapeHtml(o)}</option>`;
        }).join('');
        return `<div class="field">${label}<select name="${this.escapeAttr(field.name)}" ${field.required ? 'required' : ''}><option value="">-- Select --</option>${opts}</select></div>`;

      case 'checkbox':
        const checked = prefillValue ? ' checked' : '';
        return `<div class="field"><div class="checkbox-field"><input type="checkbox" name="${this.escapeAttr(field.name)}"${checked}><label class="field-label" style="margin:0">${this.escapeHtml(field.label)}</label></div></div>`;

      case 'radio':
        const radios = (field.options || []).map((o) => {
          const ch = o === val ? ' checked' : '';
          return `<div class="checkbox-field"><input type="radio" name="${this.escapeAttr(field.name)}" value="${this.escapeAttr(o)}"${ch}><span>${this.escapeHtml(o)}</span></div>`;
        }).join('');
        return `<div class="field">${label}${radios}</div>`;

      default:
        return `<div class="field">${label}<input type="${this.escapeAttr(field.type || 'text')}" name="${this.escapeAttr(field.name)}" value="${val}" ${field.required ? 'required' : ''} ${ph}/></div>`;
    }
  }

  private handleSubmit(fields: FormField[]): void {
    const form = this.shadowRoot?.querySelector('form');
    if (!form) return;

    const data: Record<string, any> = {};
    fields.forEach((f) => {
      if (f.type === 'checkbox') {
        const input = form.querySelector(`[name="${f.name}"]`) as HTMLInputElement;
        data[f.name] = input?.checked || false;
      } else {
        const input = form.querySelector(`[name="${f.name}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        data[f.name] = input?.value || '';
      }
    });

    const summary = fields
      .filter((f) => data[f.name] && data[f.name] !== '' && data[f.name] !== false)
      .map((f) => `${f.label}: ${data[f.name]}`)
      .join(', ');

    this.emitAction('submit', {
      value: data,
      label: `Form submitted: ${summary}`,
    });
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escapeAttr(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const FORM_REGISTRATION: RegisterOptions = {
  schema: {
    title: { type: 'string', default: '' },
    fields: { type: 'array' },
    inputs: { type: 'array' },
    items: { type: 'array' },
    submitLabel: { type: 'string', default: 'Submit' },
    buttonText: { type: 'string' },
    submit: { type: 'string' },
    prefill: { type: 'object' },
    defaults: { type: 'object' },
    values: { type: 'object' },
  },
  category: 'block',
  skeleton: {
    html: '<div class="livellm-skeleton" style="height:200px;border-radius:8px;background:#f0f0f0;"><div class="shimmer"></div></div>',
    height: '200px',
  },
};
