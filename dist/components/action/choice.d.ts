import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMChoice extends LiveLLMComponent {
    private selectedIndex;
    private submitted;
    private normalizeOption;
    render(): void;
    private selectOption;
    private escapeHtml;
}
export declare const CHOICE_REGISTRATION: RegisterOptions;
