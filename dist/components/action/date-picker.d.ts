import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMDatePicker extends LiveLLMComponent {
    private selectedDate;
    private submitted;
    render(): void;
    private submitDate;
    private formatDate;
    private escapeHtml;
}
export declare const DATE_PICKER_REGISTRATION: RegisterOptions;
