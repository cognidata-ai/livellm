import type { DetectorDefinition, DetectionMatch } from '../utils/types';

/**
 * List Detector — Detects ordered lists that represent sequential steps
 * and transforms them into livellm:accordion components.
 *
 * Heuristics for step detection:
 * - Ordered list (1. 2. 3.)
 * - Each item has substantial content (not just a word)
 * - Items represent a sequential process (keywords: first, then, next, finally, etc.)
 */

const ORDERED_ITEM_RE = /^[\t ]*(\d+)[.)]\s+(.+)$/;
const STEP_KEYWORDS = /\b(step|first|then|next|after|finally|lastly|begin|start|install|configure|create|setup|set up|open|click|navigate|run|execute|add|import|define|build|deploy|test|verify|check)\b/i;

interface ListBlock {
  items: { number: number; text: string }[];
  hasStepPattern: boolean;
}

function findOrderedLists(markdown: string): { block: ListBlock; start: number; end: number }[] {
  const results: { block: ListBlock; start: number; end: number }[] = [];
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const match = lines[i].match(ORDERED_ITEM_RE);
    if (match) {
      const listStart = i;
      const items: { number: number; text: string }[] = [];
      let j = i;

      // Gather all consecutive ordered list items (allowing continuation lines)
      while (j < lines.length) {
        const itemMatch = lines[j].match(ORDERED_ITEM_RE);
        if (itemMatch) {
          let text = itemMatch[2];
          // Check for continuation lines (indented, not a new list item)
          let k = j + 1;
          while (k < lines.length) {
            const nextLine = lines[k];
            const isContinuation = nextLine.match(/^[\t ]{2,}\S/) && !nextLine.match(ORDERED_ITEM_RE);
            if (isContinuation) {
              text += ' ' + nextLine.trim();
              k++;
            } else if (nextLine.trim() === '') {
              // Allow one blank line within continuation
              if (k + 1 < lines.length && lines[k + 1].match(/^[\t ]{2,}\S/)) {
                k++;
              } else {
                break;
              }
            } else {
              break;
            }
          }
          items.push({ number: parseInt(itemMatch[1], 10), text: text.trim() });
          j = k;
        } else if (lines[j].trim() === '') {
          // Allow blank lines between items
          j++;
        } else {
          break;
        }
      }

      if (items.length >= 3) {
        // Calculate offsets
        let startOffset = 0;
        for (let k = 0; k < listStart; k++) {
          startOffset += lines[k].length + 1;
        }
        let endOffset = startOffset;
        for (let k = listStart; k < j; k++) {
          endOffset += lines[k].length + (k < j - 1 ? 1 : 0);
        }
        if (j < lines.length) endOffset += 1;

        // Check for step-like content
        const stepCount = items.filter((item) => STEP_KEYWORDS.test(item.text)).length;
        const hasStepPattern = stepCount >= items.length * 0.4;

        // Check that items are sequential
        const isSequential = items.every((item, idx) => idx === 0 || item.number > items[idx - 1].number);

        // Only include if items have meaningful content
        const avgLength = items.reduce((sum, it) => sum + it.text.length, 0) / items.length;
        if (avgLength >= 15 && isSequential) {
          results.push({
            block: { items, hasStepPattern },
            start: startOffset,
            end: endOffset,
          });
        }
      }

      i = j;
      continue;
    }
    i++;
  }

  return results;
}

export const listDetector: DetectorDefinition = {
  detect(markdown: string): DetectionMatch[] {
    const lists = findOrderedLists(markdown);

    return lists.map(({ block, start, end }) => ({
      start,
      end,
      data: {
        items: block.items,
        hasStepPattern: block.hasStepPattern,
      },
      confidence: calculateListConfidence(block),
      apply: () => {},
    }));
  },

  transform(match: DetectionMatch): string {
    const { items } = match.data;

    const sections = items.map((item: { number: number; text: string }) => ({
      title: `Step ${item.number}`,
      content: item.text,
    }));

    const props = {
      sections,
      mode: 'exclusive' as const,
      defaultOpen: 0,
    };

    return '```livellm:accordion\n' + JSON.stringify(props) + '\n```';
  },
};

function calculateListConfidence(block: ListBlock): number {
  let confidence = 0.65;

  // Step-like keywords boost confidence
  if (block.hasStepPattern) confidence += 0.15;

  // More items = clearer step sequence
  if (block.items.length >= 5) confidence += 0.1;
  if (block.items.length >= 8) confidence += 0.05;

  // Long detailed items benefit more from accordion
  const avgLen = block.items.reduce((s, i) => s + i.text.length, 0) / block.items.length;
  if (avgLen >= 50) confidence += 0.05;

  return Math.min(confidence, 1.0);
}
