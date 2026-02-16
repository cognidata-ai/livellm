import type { DetectorDefinition, DetectionMatch } from '../utils/types';

/**
 * Link Detector — Detects standalone URLs (not in markdown links) and
 * transforms them into livellm:link-preview components.
 */

// Matches standalone URLs on their own line (not inside markdown links or images)
// Negative lookbehind for ]( and ![ to avoid matching markdown links/images
const STANDALONE_URL_RE = /^(?:https?:\/\/)[^\s<>"{}|\\^`[\]]+$/gm;

// URLs already in markdown link format: [text](url) or ![alt](url)
const MD_LINK_RE = /!?\[([^\]]*)\]\(([^)]+)\)/g;

// Known content sites that benefit from preview
const PREVIEW_DOMAINS = new Set([
  'github.com', 'stackoverflow.com', 'youtube.com', 'youtu.be',
  'twitter.com', 'x.com', 'medium.com', 'dev.to', 'reddit.com',
  'wikipedia.org', 'npmjs.com', 'pypi.org', 'docs.google.com',
  'arxiv.org', 'news.ycombinator.com',
]);

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isUrlInMarkdownLink(markdown: string, urlStart: number, urlEnd: number): boolean {
  // Check if this URL is part of a markdown link [text](url) or ![alt](url)
  MD_LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MD_LINK_RE.exec(markdown)) !== null) {
    const linkStart = m.index;
    const linkEnd = m.index + m[0].length;
    if (urlStart >= linkStart && urlEnd <= linkEnd) {
      return true;
    }
  }
  return false;
}

export const linkDetector: DetectorDefinition = {
  detect(markdown: string): DetectionMatch[] {
    const matches: DetectionMatch[] = [];

    STANDALONE_URL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = STANDALONE_URL_RE.exec(markdown)) !== null) {
      const url = m[0].trim();
      const start = m.index;
      const end = m.index + m[0].length;

      // Skip if already inside a markdown link
      if (isUrlInMarkdownLink(markdown, start, end)) continue;

      const domain = getDomain(url);
      if (!domain) continue;

      const isPreviewDomain = PREVIEW_DOMAINS.has(domain);

      matches.push({
        start,
        end,
        data: {
          url,
          domain,
          isPreviewDomain,
        },
        confidence: isPreviewDomain ? 0.85 : 0.7,
        apply: () => {},
      });
    }

    return matches;
  },

  transform(match: DetectionMatch): string {
    const { url, domain } = match.data;

    const props: Record<string, any> = {
      url,
      domain,
    };

    return '```livellm:link-preview\n' + JSON.stringify(props) + '\n```';
  },
};
