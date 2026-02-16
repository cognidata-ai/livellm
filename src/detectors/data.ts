import type { DetectorDefinition, DetectionMatch } from '../utils/types';

/**
 * Data Detector — Detects patterns of numeric data (key-value pairs,
 * statistics, metrics) and transforms them into livellm:chart components.
 *
 * Patterns detected:
 * - "Label: 123" or "Label: 45%" style key-value lists
 * - Bullet lists with numeric values
 * - Comparison patterns: "A vs B: 100 vs 200"
 */

// Matches "Label: 123", "Label: 45%", "Label: $1,234"
const KEY_VALUE_RE = /^[\t ]*[-*]?\s*\**(.+?)\**\s*[:–—]\s*[$]?([\d,]+\.?\d*)\s*(%|[KMBkmb])?/;

// Matches "- Label: 123" style bullet points with values
const BULLET_VALUE_RE = /^[\t ]*[-*]\s+(.+?):\s*[$]?([\d,]+\.?\d*)\s*(%|[KMBkmb])?$/;

interface DataPoint {
  label: string;
  value: number;
  suffix: string;
}

interface DataBlock {
  points: DataPoint[];
  hasPercentages: boolean;
  isTimeSeries: boolean;
}

function parseNumericValue(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''));
}

function findDataBlocks(markdown: string): { block: DataBlock; start: number; end: number }[] {
  const results: { block: DataBlock; start: number; end: number }[] = [];
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const points: DataPoint[] = [];
    const blockStart = i;
    let hasPercentages = false;

    // Try to match consecutive key-value lines
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line === '') {
        // Allow one blank line within a block
        if (i + 1 < lines.length && (KEY_VALUE_RE.test(lines[i + 1].trim()) || BULLET_VALUE_RE.test(lines[i + 1].trim()))) {
          i++;
          continue;
        }
        break;
      }

      let match = line.match(KEY_VALUE_RE) || line.match(BULLET_VALUE_RE);
      if (match) {
        const label = match[1].trim();
        const value = parseNumericValue(match[2]);
        const suffix = match[3] || '';
        if (!isNaN(value)) {
          points.push({ label, value, suffix });
          if (suffix === '%') hasPercentages = true;
        }
        i++;
      } else {
        break;
      }
    }

    if (points.length >= 3) {
      // Calculate offsets
      let startOffset = 0;
      for (let k = 0; k < blockStart; k++) {
        startOffset += lines[k].length + 1;
      }
      let endOffset = startOffset;
      for (let k = blockStart; k < i; k++) {
        endOffset += lines[k].length + (k < i - 1 ? 1 : 0);
      }
      if (i < lines.length) endOffset += 1;

      // Check if labels look like time series (years, months, dates)
      const timeLabels = points.filter((p) =>
        /^\d{4}$/.test(p.label) ||
        /^(Q[1-4]|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(p.label) ||
        /^\d{1,2}\/\d{1,2}/.test(p.label)
      );
      const isTimeSeries = timeLabels.length >= points.length * 0.6;

      results.push({
        block: { points, hasPercentages, isTimeSeries },
        start: startOffset,
        end: endOffset,
      });
    }

    if (points.length < 3) i++;
  }

  return results;
}

export const dataDetector: DetectorDefinition = {
  detect(markdown: string): DetectionMatch[] {
    const blocks = findDataBlocks(markdown);

    return blocks.map(({ block, start, end }) => ({
      start,
      end,
      data: {
        points: block.points,
        hasPercentages: block.hasPercentages,
        isTimeSeries: block.isTimeSeries,
      },
      confidence: calculateDataConfidence(block),
      apply: () => {},
    }));
  },

  transform(match: DetectionMatch): string {
    const { points, hasPercentages, isTimeSeries } = match.data;

    // Choose chart type based on data characteristics
    let chartType: 'bar' | 'line' | 'pie' = 'bar';
    if (isTimeSeries) {
      chartType = 'line';
    } else if (hasPercentages && points.length <= 8) {
      chartType = 'pie';
    }

    const labels = points.map((p: DataPoint) => p.label);
    const values = points.map((p: DataPoint) => p.value);

    const props: Record<string, any> = {
      type: chartType,
      labels,
      datasets: [
        {
          label: 'Values',
          data: values,
        },
      ],
    };

    if (hasPercentages) {
      props.suffix = '%';
    }

    return '```livellm:chart\n' + JSON.stringify(props) + '\n```';
  },
};

function calculateDataConfidence(block: DataBlock): number {
  let confidence = 0.65;

  // More data points = higher confidence
  if (block.points.length >= 5) confidence += 0.1;
  if (block.points.length >= 8) confidence += 0.05;

  // Percentages are a clear signal for chart visualization
  if (block.hasPercentages) confidence += 0.1;

  // Time series is very chart-friendly
  if (block.isTimeSeries) confidence += 0.1;

  // Consistent suffix across all points
  const suffixes = new Set(block.points.map((p) => p.suffix));
  if (suffixes.size === 1) confidence += 0.05;

  return Math.min(confidence, 1.0);
}
