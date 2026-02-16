import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMSteps extends LiveLLMComponent {
    render(): void;
    private normalizeStep;
    private escapeHtml;
}
export declare const STEPS_REGISTRATION: RegisterOptions;
