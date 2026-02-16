import type { EventBus } from './events';
import type { TransformerConfig, DetectorDefinition } from '../utils/types';
/**
 * @livellm/transformer — Analyzes raw LLM responses and enriches them
 * with livellm: blocks where interactive components would add value.
 */
export declare class Transformer {
    private events;
    private config;
    private detectors;
    private disabledDetectors;
    constructor(events: EventBus, config?: Partial<TransformerConfig>);
    /**
     * Register a detector.
     */
    register(name: string, detector: DetectorDefinition): void;
    /**
     * Register all built-in detectors (table, question, address, code, link, list, data).
     */
    registerBuiltIns(): void;
    /**
     * Disable a specific detector.
     */
    disable(name: string): void;
    /**
     * Enable a previously disabled detector.
     */
    enable(name: string): void;
    /**
     * List active detector names.
     */
    listDetectors(): string[];
    /**
     * Transform raw markdown by detecting patterns and enriching with livellm: blocks.
     */
    transform(markdown: string): string;
    /**
     * Resolve overlapping detections — keep the one with higher confidence.
     * Input must be sorted by start position descending.
     */
    private resolveOverlaps;
    private getActiveDetectors;
}
