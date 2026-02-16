import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMCodeRunner extends LiveLLMComponent {
    private output;
    private hasError;
    render(): void;
    private copyCode;
    private runCode;
    private escapeHtml;
}
export declare const CODE_RUNNER_REGISTRATION: RegisterOptions;
