import type { EventBus } from './events';
import type { TransformerConfig, DetectorDefinition, DetectionMatch, Detection } from '../utils/types';
import { builtInDetectors } from '../detectors/index';

/**
 * @livellm/transformer — Analyzes raw LLM responses and enriches them
 * with livellm: blocks where interactive components would add value.
 */
export class Transformer {
  private events: EventBus;
  private config: TransformerConfig;
  private detectors: Map<string, DetectorDefinition> = new Map();
  private disabledDetectors: Set<string> = new Set();

  constructor(events: EventBus, config: Partial<TransformerConfig> = {}) {
    this.events = events;
    this.config = {
      mode: config.mode ?? 'auto',
      detectors: config.detectors ?? 'all',
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
    };
  }

  /**
   * Register a detector.
   */
  register(name: string, detector: DetectorDefinition): void {
    this.detectors.set(name, detector);
  }

  /**
   * Register all built-in detectors (table, question, address, code, link, list, data).
   */
  registerBuiltIns(): void {
    for (const [name, detector] of Object.entries(builtInDetectors)) {
      this.detectors.set(name, detector);
    }
  }

  /**
   * Disable a specific detector.
   */
  disable(name: string): void {
    this.disabledDetectors.add(name);
  }

  /**
   * Enable a previously disabled detector.
   */
  enable(name: string): void {
    this.disabledDetectors.delete(name);
  }

  /**
   * List active detector names.
   */
  listDetectors(): string[] {
    return Array.from(this.detectors.keys()).filter(
      (name) => !this.disabledDetectors.has(name)
    );
  }

  /**
   * Transform raw markdown by detecting patterns and enriching with livellm: blocks.
   */
  transform(markdown: string): string {
    if (this.config.mode === 'off') {
      return markdown;
    }

    this.events.emit('transformer:start', markdown);

    const activeDetectors = this.getActiveDetectors();

    // Collect all matches with their original DetectionMatch data
    const allMatches: { type: string; match: DetectionMatch }[] = [];

    for (const [name, detector] of activeDetectors) {
      try {
        const matches = detector.detect(markdown);
        for (const match of matches) {
          allMatches.push({ type: name, match });
        }
      } catch (err) {
        console.error(`[LiveLLM Transformer] Detector "${name}" failed:`, err);
      }
    }

    // Build Detection array for events
    const allDetections: Detection[] = allMatches.map(({ type, match }) => ({
      type,
      position: { start: match.start, end: match.end },
      confidence: match.confidence,
      apply: () => {},
    }));

    this.events.emit('transformer:detected', allDetections);

    if (this.config.mode === 'passive') {
      return markdown;
    }

    // Auto mode: apply transformations above confidence threshold
    // Filter by confidence, sort by position descending (to avoid offset issues)
    const applicable = allMatches
      .filter((d) => d.match.confidence >= this.config.confidenceThreshold)
      .sort((a, b) => b.match.start - a.match.start);

    // Remove overlapping detections (keep higher confidence)
    const nonOverlapping = this.resolveOverlaps(applicable);

    let result = markdown;
    for (const { type, match } of nonOverlapping) {
      const detector = this.detectors.get(type);
      if (!detector) continue;

      const transformed = detector.transform(match);
      result =
        result.substring(0, match.start) +
        transformed +
        result.substring(match.end);
    }

    this.events.emit('transformer:enriched', result);
    return result;
  }

  /**
   * Resolve overlapping detections — keep the one with higher confidence.
   * Input must be sorted by start position descending.
   */
  private resolveOverlaps(
    sorted: { type: string; match: DetectionMatch }[]
  ): { type: string; match: DetectionMatch }[] {
    if (sorted.length <= 1) return sorted;

    const result: { type: string; match: DetectionMatch }[] = [];
    const used = new Set<number>();

    // Sort by confidence desc first, then apply greedily
    const byConfidence = [...sorted].sort((a, b) => b.match.confidence - a.match.confidence);

    for (const item of byConfidence) {
      let overlaps = false;
      for (const idx of used) {
        const existing = byConfidence[idx];
        if (
          item.match.start < existing.match.end &&
          item.match.end > existing.match.start
        ) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        used.add(byConfidence.indexOf(item));
        result.push(item);
      }
    }

    // Re-sort by position descending for safe substring replacement
    return result.sort((a, b) => b.match.start - a.match.start);
  }

  private getActiveDetectors(): Map<string, DetectorDefinition> {
    const active = new Map<string, DetectorDefinition>();
    const allowedDetectors = this.config.detectors;

    for (const [name, detector] of this.detectors) {
      if (this.disabledDetectors.has(name)) continue;
      if (allowedDetectors !== 'all' && !allowedDetectors.includes(name)) continue;
      active.set(name, detector);
    }

    return active;
  }
}
