import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMTablePlus extends LiveLLMComponent {
    private sortKey;
    private sortDir;
    private searchQuery;
    private currentPage;
    private selectedRows;
    render(): void;
    private bindTableEvents;
    private normalizeColumn;
    private escapeHtml;
    private escapeAttr;
}
export declare const TABLE_PLUS_REGISTRATION: RegisterOptions;
