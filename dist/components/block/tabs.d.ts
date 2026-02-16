import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMTabs extends LiveLLMComponent {
    private activeTab;
    render(): void;
    private switchTab;
    private normalizeTab;
    private escapeHtml;
}
export declare const TABS_REGISTRATION: RegisterOptions;
