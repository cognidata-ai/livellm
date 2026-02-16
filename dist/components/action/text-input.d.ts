import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMTextInput extends LiveLLMComponent {
    private text;
    private submitted;
    render(): void;
    private submitText;
    private escapeHtml;
    private escapeAttr;
}
export declare const TEXT_INPUT_REGISTRATION: RegisterOptions;
