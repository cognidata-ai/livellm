import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const STEPS_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .steps-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 20px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .steps-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 16px;
  }
  .step {
    display: flex;
    gap: 14px;
    position: relative;
    padding-bottom: 20px;
  }
  .step:last-child { padding-bottom: 0; }
  .step-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }
  .step-number {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border: 2px solid var(--livellm-border, #e0e0e0);
    color: var(--livellm-text-secondary, #6c757d);
    z-index: 1;
  }
  .step.completed .step-number {
    background: var(--livellm-success, #00b894);
    border-color: var(--livellm-success, #00b894);
    color: #fff;
  }
  .step.active .step-number {
    background: var(--livellm-primary, #6c5ce7);
    border-color: var(--livellm-primary, #6c5ce7);
    color: #fff;
  }
  .step-line {
    width: 2px;
    flex: 1;
    background: var(--livellm-border, #e0e0e0);
    margin-top: 4px;
  }
  .step.completed .step-line {
    background: var(--livellm-success, #00b894);
  }
  .step-content { flex: 1; padding-top: 2px; }
  .step-label {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .step-description {
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    line-height: var(--livellm-line-height, 1.6);
  }
`;

interface StepData {
  label: string;
  description?: string;
  status?: 'completed' | 'active' | 'pending';
}

export class LiveLLMSteps extends LiveLLMComponent {
  render(): void {
    const title: string = this._props.title || '';
    const rawSteps = this._props.steps || this._props.items || this._props.stages || [];
    const steps: StepData[] = Array.isArray(rawSteps)
      ? rawSteps.map((s: any) => this.normalizeStep(s))
      : [];
    const current: number = this._props.current ?? this._props.currentStep ?? -1;

    this.setStyles(STEPS_STYLES);

    const stepsHtml = steps.map((step, i) => {
      let status = step.status || 'pending';
      if (current >= 0) {
        if (i < current) status = 'completed';
        else if (i === current) status = 'active';
        else status = 'pending';
      }

      const checkmark = status === 'completed' ? '\u2713' : `${i + 1}`;
      const showLine = i < steps.length - 1;

      return `
        <div class="step ${status}">
          <div class="step-indicator">
            <div class="step-number">${checkmark}</div>
            ${showLine ? '<div class="step-line"></div>' : ''}
          </div>
          <div class="step-content">
            <div class="step-label">${this.escapeHtml(step.label)}</div>
            ${step.description ? `<div class="step-description">${this.escapeHtml(step.description)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    this.setContent(`
      <div class="steps-container">
        ${title ? `<div class="steps-title">${this.escapeHtml(title)}</div>` : ''}
        ${stepsHtml}
      </div>
    `);
  }

  private normalizeStep(step: any): StepData {
    if (typeof step === 'string') {
      return { label: step };
    }
    if (!step || typeof step !== 'object') {
      return { label: String(step ?? '') };
    }
    return {
      label: String(step.label ?? step.title ?? step.name ?? step.text ?? ''),
      description: step.description ?? step.content ?? step.body ?? step.detail ?? undefined,
      status: step.status,
    };
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const STEPS_REGISTRATION: RegisterOptions = {
  schema: {
    title: { type: 'string', default: '' },
    steps: { type: 'array' },
    items: { type: 'array' },
    stages: { type: 'array' },
    current: { type: 'number', default: -1 },
    currentStep: { type: 'number' },
  },
  category: 'block',
  skeleton: {
    html: '<div style="height:200px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '200px',
  },
};
