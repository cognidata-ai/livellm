import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMConfirm extends LiveLLMComponent {
    private answered;
    private answer;
    render(): void;
    private handleAction;
    private escapeHtml;
}
export declare const CONFIRM_REGISTRATION: RegisterOptions;
