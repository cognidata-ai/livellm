import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMFileUpload extends LiveLLMComponent {
    private selectedFile;
    private submitted;
    render(): void;
    private handleFile;
    private submitFile;
    private formatSize;
    private escapeHtml;
}
export declare const FILE_UPLOAD_REGISTRATION: RegisterOptions;
