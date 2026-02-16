import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMLinkPreview extends LiveLLMComponent {
    render(): void;
    private getDomain;
    private escapeHtml;
    private escapeAttr;
}
export declare const LINK_PREVIEW_REGISTRATION: RegisterOptions;
