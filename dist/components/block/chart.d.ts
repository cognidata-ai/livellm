import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';
export declare class LiveLLMChart extends LiveLLMComponent {
    render(): void;
    private renderBarChart;
    private renderPieChart;
    private renderLineChart;
    private renderLegend;
    private bindChartEvents;
    private formatNumber;
    private truncate;
    private normalizeDataset;
    private escapeHtml;
    private escapeAttr;
}
export declare const CHART_REGISTRATION: RegisterOptions;
