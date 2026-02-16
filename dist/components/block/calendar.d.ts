import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMCalendar extends LiveLLMComponent {
    private viewYear;
    private viewMonth;
    render(): void;
    private escapeHtml;
}
export declare const CALENDAR_REGISTRATION: RegisterOptions;
