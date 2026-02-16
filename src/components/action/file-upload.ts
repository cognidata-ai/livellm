import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const FILE_UPLOAD_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .fu-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .fu-label {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 10px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .fu-dropzone {
    border: 2px dashed var(--livellm-border, #e0e0e0);
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    cursor: pointer;
    transition: var(--livellm-transition, 0.2s ease);
    background: var(--livellm-bg-secondary, #f8f9fa);
  }
  .fu-dropzone:hover, .fu-dropzone.dragover {
    border-color: var(--livellm-primary, #6c5ce7);
    background: rgba(108, 92, 231, 0.04);
  }
  .fu-dropzone.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
  .fu-icon {
    font-size: 32px;
    margin-bottom: 8px;
    opacity: 0.5;
  }
  .fu-text {
    font-size: 14px;
    color: var(--livellm-text-secondary, #6c757d);
  }
  .fu-text strong { color: var(--livellm-primary, #6c5ce7); }
  .fu-hint {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-top: 4px;
  }
  .fu-file-input { display: none; }
  .fu-file-info {
    margin-top: 12px;
    padding: 10px 14px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--livellm-bg-secondary, #f8f9fa);
  }
  .fu-file-icon { font-size: 20px; }
  .fu-file-details { flex: 1; }
  .fu-file-name {
    font-weight: 500;
    font-size: 14px;
    word-break: break-all;
  }
  .fu-file-size {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
  }
  .fu-submit {
    padding: 8px 20px;
    border-radius: 6px;
    border: none;
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    transition: var(--livellm-transition, 0.2s ease);
    margin-top: 10px;
  }
  .fu-submit:hover { opacity: 0.9; }
  .fu-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export class LiveLLMFileUpload extends LiveLLMComponent {
  private selectedFile: File | null = null;
  private submitted: boolean = false;

  render(): void {
    const label: string = this._props.label || 'Upload a file';
    const accept: string = this._props.accept || '';
    const maxSizeMB: number = this._props.maxSizeMB ?? 10;
    const multiple: boolean = this._props.multiple ?? false;

    this.setStyles(FILE_UPLOAD_STYLES);

    const acceptHint = accept ? `Accepted: ${accept}` : '';
    const sizeHint = `Max size: ${maxSizeMB}MB`;

    let fileInfoHtml = '';
    if (this.selectedFile) {
      fileInfoHtml = `
        <div class="fu-file-info">
          <span class="fu-file-icon">\uD83D\uDCC4</span>
          <div class="fu-file-details">
            <div class="fu-file-name">${this.escapeHtml(this.selectedFile.name)}</div>
            <div class="fu-file-size">${this.formatSize(this.selectedFile.size)}</div>
          </div>
        </div>
        ${!this.submitted ? '<button class="fu-submit">Upload</button>' : ''}
      `;
    }

    this.setContent(`
      <div class="fu-container">
        <div class="fu-label">${this.escapeHtml(label)}</div>
        <div class="fu-dropzone${this.submitted ? ' disabled' : ''}">
          <div class="fu-icon">\u2B06\uFE0F</div>
          <div class="fu-text"><strong>Click to browse</strong> or drag & drop</div>
          <div class="fu-hint">${[acceptHint, sizeHint].filter(Boolean).join(' \u2022 ')}</div>
          <input type="file" class="fu-file-input"
            ${accept ? `accept="${this.escapeHtml(accept)}"` : ''}
            ${multiple ? 'multiple' : ''}
            ${this.submitted ? 'disabled' : ''}
          />
        </div>
        ${fileInfoHtml}
      </div>
    `);

    if (!this.submitted) {
      const dropzone = this.shadowRoot?.querySelector('.fu-dropzone');
      const input = this.shadowRoot?.querySelector('.fu-file-input') as HTMLInputElement;
      const submitBtn = this.shadowRoot?.querySelector('.fu-submit');

      dropzone?.addEventListener('click', () => {
        input?.click();
      });

      dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone?.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const files = (e as DragEvent).dataTransfer?.files;
        if (files && files.length > 0) {
          this.handleFile(files[0], maxSizeMB);
        }
      });

      input?.addEventListener('change', () => {
        if (input.files && input.files.length > 0) {
          this.handleFile(input.files[0], maxSizeMB);
        }
      });

      submitBtn?.addEventListener('click', () => {
        this.submitFile();
      });
    }
  }

  private handleFile(file: File, maxSizeMB: number): void {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return; // File too large
    }
    this.selectedFile = file;
    this.render();
  }

  private submitFile(): void {
    if (this.submitted || !this.selectedFile) return;

    this.submitted = true;
    this.render();

    this.emitAction('file-upload', {
      value: this.selectedFile.name,
      label: `Uploaded: ${this.selectedFile.name} (${this.formatSize(this.selectedFile.size)})`,
      file: {
        name: this.selectedFile.name,
        size: this.selectedFile.size,
        type: this.selectedFile.type,
      },
    });
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const FILE_UPLOAD_REGISTRATION: RegisterOptions = {
  schema: {
    label: { type: 'string', default: 'Upload a file' },
    accept: { type: 'string', default: '' },
    maxSizeMB: { type: 'number', default: 10 },
    multiple: { type: 'boolean', default: false },
  },
  category: 'action',
  skeleton: {
    html: '<div style="height:120px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '120px',
  },
};
