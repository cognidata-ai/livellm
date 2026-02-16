import { describe, it, expect } from 'vitest';
import { questionDetector } from '../../src/detectors/question';

describe('Question Detector', () => {
  it('should detect a question with numbered options', () => {
    const md = `What programming language should we use?
1. JavaScript
2. Python
3. Go
4. Rust`;

    const matches = questionDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.question).toBe('What programming language should we use?');
    expect(matches[0].data.options).toEqual(['JavaScript', 'Python', 'Go', 'Rust']);
    expect(matches[0].data.isYesNo).toBe(false);
  });

  it('should detect a question with lettered options', () => {
    const md = `Which color do you prefer?
a) Red
b) Blue
c) Green`;

    const matches = questionDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.options).toEqual(['Red', 'Blue', 'Green']);
  });

  it('should detect yes/no questions', () => {
    const md = `Would you like to proceed? (yes or no)`;

    const matches = questionDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.isYesNo).toBe(true);
    expect(matches[0].data.options).toEqual(['Yes', 'No']);
  });

  it('should detect confirm-style questions', () => {
    const md = `Do you confirm this action?`;

    const matches = questionDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.isYesNo).toBe(true);
  });

  it('should not detect regular questions without options', () => {
    const md = `What is the meaning of life?\n\nI think it's about happiness.`;

    const matches = questionDetector.detect(md);
    expect(matches.length).toBe(0);
  });

  it('should transform multi-option to livellm:choice', () => {
    const md = `What should we build?
1. A website
2. A mobile app
3. A CLI tool`;

    const matches = questionDetector.detect(md);
    const result = questionDetector.transform(matches[0]);

    expect(result).toContain('livellm:choice');
    const json = JSON.parse(result.split('\n')[1]);
    expect(json.question).toBe('What should we build?');
    expect(json.options.length).toBe(3);
    expect(json.options[0].label).toBe('A website');
  });

  it('should transform binary choice to livellm:confirm', () => {
    const md = `Ready to deploy?
1. Deploy now
2. Cancel`;

    const matches = questionDetector.detect(md);
    const result = questionDetector.transform(matches[0]);

    expect(result).toContain('livellm:confirm');
    const json = JSON.parse(result.split('\n')[1]);
    expect(json.text).toBe('Ready to deploy?');
    expect(json.confirmLabel).toBe('Deploy now');
    expect(json.cancelLabel).toBe('Cancel');
  });

  it('should handle blank lines between question and options', () => {
    const md = `Which framework?

1. React
2. Vue
3. Svelte`;

    const matches = questionDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.options.length).toBe(3);
  });

  it('should give higher confidence to questions with more options', () => {
    const md3 = `Pick one?\n1. A\n2. B\n3. C`;
    const md5 = `Pick one?\n1. A\n2. B\n3. C\n4. D\n5. E`;

    const matches3 = questionDetector.detect(md3);
    const matches5 = questionDetector.detect(md5);

    expect(matches5[0].confidence).toBeGreaterThan(matches3[0].confidence);
  });
});
