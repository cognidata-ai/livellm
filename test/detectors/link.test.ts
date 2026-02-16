import { describe, it, expect } from 'vitest';
import { linkDetector } from '../../src/detectors/link';

describe('Link Detector', () => {
  it('should detect a standalone URL on its own line', () => {
    const md = `Check out this resource:

https://github.com/some/repo

It has great documentation.`;

    const matches = linkDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.url).toBe('https://github.com/some/repo');
    expect(matches[0].data.domain).toBe('github.com');
  });

  it('should not detect URLs inside markdown links', () => {
    const md = `Visit [GitHub](https://github.com/some/repo) for more info.`;

    const matches = linkDetector.detect(md);
    expect(matches.length).toBe(0);
  });

  it('should not detect URLs inside image syntax', () => {
    const md = `![Logo](https://example.com/logo.png)`;

    const matches = linkDetector.detect(md);
    expect(matches.length).toBe(0);
  });

  it('should give higher confidence to known preview domains', () => {
    const ghMd = `https://github.com/anthropic/claude`;
    const unknownMd = `https://random-site.example.com/page`;

    const ghMatches = linkDetector.detect(ghMd);
    const unknownMatches = linkDetector.detect(unknownMd);

    expect(ghMatches[0].confidence).toBeGreaterThan(unknownMatches[0].confidence);
  });

  it('should detect multiple standalone URLs', () => {
    const md = `Resources:

https://github.com/project
https://stackoverflow.com/questions/12345
https://dev.to/article`;

    const matches = linkDetector.detect(md);
    expect(matches.length).toBe(3);
  });

  it('should transform to livellm:link-preview', () => {
    const md = `https://youtube.com/watch?v=abc123`;

    const matches = linkDetector.detect(md);
    const result = linkDetector.transform(matches[0]);

    expect(result).toContain('livellm:link-preview');
    const json = JSON.parse(result.split('\n')[1]);
    expect(json.url).toBe('https://youtube.com/watch?v=abc123');
    expect(json.domain).toBe('youtube.com');
  });

  it('should strip www prefix from domain', () => {
    const md = `https://www.reddit.com/r/programming`;

    const matches = linkDetector.detect(md);
    expect(matches[0].data.domain).toBe('reddit.com');
  });
});
