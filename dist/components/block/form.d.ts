import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMForm extends LiveLLMComponent {
    render(): void;
    private renderField;
    private handleSubmit;
    private escapeHtml;
    private escapeAttr;
}
export declare const FORM_REGISTRATION: RegisterOptions;
