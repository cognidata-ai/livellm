import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMRatingInput extends LiveLLMComponent {
    private rating;
    private hoveredRating;
    private submitted;
    render(): void;
    private setRating;
    private escapeHtml;
}
export declare const RATING_INPUT_REGISTRATION: RegisterOptions;
