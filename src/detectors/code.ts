import type { DetectorDefinition, DetectionMatch } from '../utils/types';

/**
 * Code Detector — Detects standard code fences (```lang) and transforms
 * them into livellm:code-runner components with syntax highlighting and
 * optional execution capability.
 *
 * Only detects non-livellm code blocks (regular markdown code fences).
 */

// Matches a full fenced code block: ```lang\ncode\n```
const CODE_FENCE_RE = /^```(\w+)\n([\s\S]*?)^```$/gm;

// Languages that are typically runnable
const RUNNABLE_LANGUAGES = new Set([
  'javascript', 'js',
  'typescript', 'ts',
  'python', 'py',
  'html',
  'css',
  'sql',
  'shell', 'bash', 'sh',
]);

// Languages with well-known syntax highlighting
const KNOWN_LANGUAGES = new Set([
  'javascript', 'js', 'typescript', 'ts', 'python', 'py',
  'java', 'c', 'cpp', 'csharp', 'cs', 'go', 'rust', 'ruby', 'rb',
  'php', 'swift', 'kotlin', 'scala', 'html', 'css', 'scss', 'less',
  'json', 'yaml', 'yml', 'xml', 'toml', 'ini', 'markdown', 'md',
  'sql', 'graphql', 'shell', 'bash', 'sh', 'powershell', 'ps1',
  'dockerfile', 'makefile', 'lua', 'r', 'perl', 'elixir', 'erlang',
  'haskell', 'clojure', 'dart', 'objective-c', 'objc',
]);

export const codeDetector: DetectorDefinition = {
  detect(markdown: string): DetectionMatch[] {
    const matches: DetectionMatch[] = [];

    CODE_FENCE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = CODE_FENCE_RE.exec(markdown)) !== null) {
      const lang = m[1].toLowerCase();
      const code = m[2];

      // Skip livellm blocks
      if (lang.startsWith('livellm:')) continue;

      // Skip very short code (likely inline examples)
      if (code.trim().split('\n').length < 2 && code.trim().length < 20) continue;

      const isRunnable = RUNNABLE_LANGUAGES.has(lang);
      const isKnown = KNOWN_LANGUAGES.has(lang);

      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        data: {
          language: lang,
          code: code.trimEnd(),
          runnable: isRunnable,
        },
        confidence: calculateCodeConfidence(lang, code, isKnown),
        apply: () => {},
      });
    }

    return matches;
  },

  transform(match: DetectionMatch): string {
    const { language, code, runnable } = match.data;

    const props: Record<string, any> = {
      language,
      code,
      showLineNumbers: code.split('\n').length > 5,
      copyable: true,
    };

    if (runnable) {
      props.runnable = true;
    }

    return '```livellm:code-runner\n' + JSON.stringify(props) + '\n```';
  },
};

function calculateCodeConfidence(lang: string, code: string, isKnown: boolean): number {
  let confidence = 0.6;

  // Known language boosts confidence
  if (isKnown) confidence += 0.15;

  // Longer code blocks benefit more from enhanced rendering
  const lineCount = code.split('\n').length;
  if (lineCount >= 5) confidence += 0.1;
  if (lineCount >= 15) confidence += 0.05;

  // Runnable code has more to gain from code-runner
  if (RUNNABLE_LANGUAGES.has(lang)) confidence += 0.05;

  return Math.min(confidence, 1.0);
}
