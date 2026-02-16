import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMMultiChoice extends LiveLLMComponent {
    private selectedIndices;
    private submitted;
    private normalizeOption;
    render(): void;
    private toggleOption;
    private submitSelection;
    private escapeHtml;
}
export declare const MULTI_CHOICE_REGISTRATION: RegisterOptions;
