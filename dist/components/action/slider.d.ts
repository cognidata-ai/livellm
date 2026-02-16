import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMSlider extends LiveLLMComponent {
    private value;
    private submitted;
    render(): void;
    private submitValue;
    private escapeHtml;
}
export declare const SLIDER_REGISTRATION: RegisterOptions;
