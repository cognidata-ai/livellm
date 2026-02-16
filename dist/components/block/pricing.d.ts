import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMPricing extends LiveLLMComponent {
    render(): void;
    private normalizeTier;
    private escapeHtml;
}
export declare const PRICING_REGISTRATION: RegisterOptions;
