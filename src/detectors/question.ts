import type { DetectorDefinition, DetectionMatch } from '../utils/types';

/**
 * Question Detector — Detects questions with numbered/lettered options
 * and transforms them into livellm:choice or livellm:confirm components.
 */

// Matches a line containing a question mark
const QUESTION_RE = /^(.+\?.*?)$/m;

// Matches numbered options: "1. Option", "1) Option", "a. Option", "a) Option"
const NUMBERED_OPTION_RE = /^[\t ]*(?:(\d+|[a-zA-Z])[.)]\s+)(.+)$/;

// Matches yes/no style questions
const YES_NO_RE = /\b(yes\s*(?:\/|or)\s*no|confirm|agree|proceed|continue|accept|approve)\b/i;

interface QuestionBlock {
  question: string;
  options: string[];
  isYesNo: boolean;
}

function findQuestionBlocks(markdown: string): { block: QuestionBlock; start: number; end: number }[] {
  const results: { block: QuestionBlock; start: number; end: number }[] = [];
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Check if this line is a question
    const qMatch = line.match(QUESTION_RE);
    if (qMatch) {
      const question = qMatch[1];

      // Check if next lines contain options
      const options: string[] = [];
      let j = i + 1;

      // Skip blank lines between question and options
      while (j < lines.length && lines[j].trim() === '') {
        j++;
      }

      // Gather option lines
      while (j < lines.length) {
        const optMatch = lines[j].match(NUMBERED_OPTION_RE);
        if (optMatch) {
          options.push(optMatch[2].trim());
          j++;
        } else {
          break;
        }
      }

      if (options.length >= 2) {
        // Calculate offsets
        let startOffset = 0;
        for (let k = 0; k < i; k++) {
          startOffset += lines[k].length + 1;
        }
        let endOffset = startOffset;
        for (let k = i; k < j; k++) {
          endOffset += lines[k].length + (k < j - 1 ? 1 : 0);
        }
        if (j < lines.length) endOffset += 1;

        results.push({
          block: {
            question,
            options,
            isYesNo: false,
          },
          start: startOffset,
          end: endOffset,
        });

        i = j;
        continue;
      }

      // Check for yes/no pattern in the question itself
      if (YES_NO_RE.test(question) && options.length === 0) {
        let startOffset = 0;
        for (let k = 0; k < i; k++) {
          startOffset += lines[k].length + 1;
        }
        const endOffset = startOffset + lines[i].length + (i + 1 < lines.length ? 1 : 0);

        results.push({
          block: {
            question,
            options: ['Yes', 'No'],
            isYesNo: true,
          },
          start: startOffset,
          end: endOffset,
        });
      }
    }
    i++;
  }

  return results;
}

export const questionDetector: DetectorDefinition = {
  detect(markdown: string): DetectionMatch[] {
    const blocks = findQuestionBlocks(markdown);

    return blocks.map(({ block, start, end }) => ({
      start,
      end,
      data: {
        question: block.question,
        options: block.options,
        isYesNo: block.isYesNo,
      },
      confidence: calculateQuestionConfidence(block),
      apply: () => {},
    }));
  },

  transform(match: DetectionMatch): string {
    const { question, options, isYesNo } = match.data;

    if (isYesNo || options.length === 2) {
      // Use confirm component for binary choices
      const props = {
        text: question,
        confirmLabel: options[0],
        cancelLabel: options[1],
      };
      return '```livellm:confirm\n' + JSON.stringify(props) + '\n```';
    }

    // Use choice component for multiple options
    const props = {
      question,
      options: options.map((opt: string, idx: number) => ({
        label: opt,
        value: `option_${idx}`,
      })),
    };
    return '```livellm:choice\n' + JSON.stringify(props) + '\n```';
  },
};

function calculateQuestionConfidence(block: QuestionBlock): number {
  let confidence = 0.7;

  // Yes/no questions are very clear intent
  if (block.isYesNo) confidence += 0.15;

  // More options = clearer pattern
  if (block.options.length >= 3) confidence += 0.1;
  if (block.options.length >= 5) confidence += 0.05;

  // Short, clear options
  const avgOptionLen = block.options.reduce((sum, o) => sum + o.length, 0) / block.options.length;
  if (avgOptionLen < 50) confidence += 0.05;

  return Math.min(confidence, 1.0);
}
