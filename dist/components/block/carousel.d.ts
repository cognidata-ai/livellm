import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMCarousel extends LiveLLMComponent {
    private currentSlide;
    render(): void;
    private navigate;
    private normalizeSlide;
    private escapeHtml;
    private escapeAttr;
}
export declare const CAROUSEL_REGISTRATION: RegisterOptions;
