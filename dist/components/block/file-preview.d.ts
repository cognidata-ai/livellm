import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMFilePreview extends LiveLLMComponent {
    render(): void;
    private escapeHtml;
    private escapeAttr;
}
export declare const FILE_PREVIEW_REGISTRATION: RegisterOptions;
