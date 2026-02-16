import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMTimeline extends LiveLLMComponent {
    render(): void;
    private normalizeEvent;
    private escapeHtml;
}
export declare const TIMELINE_REGISTRATION: RegisterOptions;
