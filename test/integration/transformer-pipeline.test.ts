import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Transformer } from '../../src/core/transformer';

describe('Transformer Pipeline Integration', () => {
  let events: EventBus;
  let transformer: Transformer;

  beforeEach(() => {
    events = new EventBus();
    transformer = new Transformer(events);
    transformer.registerBuiltIns();
  });

  it('should register all 7 built-in detectors', () => {
    const detectors = transformer.listDetectors();
    expect(detectors).toContain('table');
    expect(detectors).toContain('question');
    expect(detectors).toContain('address');
    expect(detectors).toContain('code');
    expect(detectors).toContain('link');
    expect(detectors).toContain('list');
    expect(detectors).toContain('data');
    expect(detectors.length).toBe(7);
  });

  it('should transform a markdown table to table-plus', () => {
    const md = `Here is some data:

| Product | Price | Qty |
| --- | --- | --- |
| Widget | 10 | 100 |
| Gadget | 20 | 50 |
| Thing | 15 | 75 |

And that's it.`;

    const result = transformer.transform(md);
    expect(result).toContain('livellm:table-plus');
    expect(result).toContain('Here is some data:');
    expect(result).toContain("And that's it.");
  });

  it('should transform a question with options to choice', () => {
    const md = `Please select your preferred language:

What language do you prefer?
1. JavaScript
2. Python
3. Go`;

    const result = transformer.transform(md);
    expect(result).toContain('livellm:choice');
  });

  it('should transform numeric data to chart', () => {
    const md = `## Quarterly Results

Q1: 150
Q2: 200
Q3: 175
Q4: 250

Great performance overall.`;

    const result = transformer.transform(md);
    expect(result).toContain('livellm:chart');
    expect(result).toContain('## Quarterly Results');
    expect(result).toContain('Great performance overall.');
  });

  it('should not transform in passive mode', () => {
    const passiveTransformer = new Transformer(events, { mode: 'passive' });
    passiveTransformer.registerBuiltIns();

    const onDetected = vi.fn();
    events.on('transformer:detected', onDetected);

    const md = `| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |`;
    const result = passiveTransformer.transform(md);

    expect(result).toBe(md);
    expect(onDetected).toHaveBeenCalled();
    const detections = onDetected.mock.calls[0][0];
    expect(detections.length).toBeGreaterThan(0);
  });

  it('should not transform in off mode', () => {
    const offTransformer = new Transformer(events, { mode: 'off' });
    offTransformer.registerBuiltIns();

    const md = `| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |`;
    const result = offTransformer.transform(md);

    expect(result).toBe(md);
  });

  it('should only run specific detectors when configured', () => {
    const limited = new Transformer(events, { detectors: ['table'] });
    limited.registerBuiltIns();

    const md = `| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |\n\nQ1: 100\nQ2: 200\nQ3: 300`;

    const result = limited.transform(md);
    expect(result).toContain('livellm:table-plus');
    expect(result).not.toContain('livellm:chart');
  });

  it('should respect confidence threshold', () => {
    const highThreshold = new Transformer(events, { confidenceThreshold: 0.99 });
    highThreshold.registerBuiltIns();

    const md = `| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |`;
    const result = highThreshold.transform(md);

    // With 0.99 threshold, most detections won't pass
    expect(result).not.toContain('livellm:');
  });

  it('should handle disabled detectors', () => {
    transformer.disable('table');

    const md = `| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |`;
    const result = transformer.transform(md);

    expect(result).not.toContain('livellm:table-plus');

    transformer.enable('table');
    const result2 = transformer.transform(md);
    expect(result2).toContain('livellm:table-plus');
  });

  it('should emit transformer events', () => {
    const onStart = vi.fn();
    const onDetected = vi.fn();
    const onEnriched = vi.fn();

    events.on('transformer:start', onStart);
    events.on('transformer:detected', onDetected);
    events.on('transformer:enriched', onEnriched);

    transformer.transform('Sales: 100\nCosts: 50\nProfit: 50');

    expect(onStart).toHaveBeenCalled();
    expect(onDetected).toHaveBeenCalled();
    expect(onEnriched).toHaveBeenCalled();
  });

  it('should handle multiple transformations without overlap issues', () => {
    const md = `## Data

Revenue: 500
Costs: 200
Profit: 300

## Steps

1. First install the required dependencies
2. Then configure the environment settings
3. Finally run the development server

## Table

| Name | Score |
| --- | --- |
| Alice | 95 |
| Bob | 87 |
| Charlie | 92 |`;

    const result = transformer.transform(md);

    // Should have transformed at least some of the content
    const livellmCount = (result.match(/livellm:/g) || []).length;
    expect(livellmCount).toBeGreaterThanOrEqual(1);

    // Original section headers should be preserved
    expect(result).toContain('## Data');
    expect(result).toContain('## Steps');
    expect(result).toContain('## Table');
  });

  it('should preserve markdown that has no detectable patterns', () => {
    const md = `# Hello World

This is a simple paragraph with **bold** and *italic* text.

- A bullet point
- Another bullet point

Nothing special here.`;

    const result = transformer.transform(md);
    expect(result).toBe(md);
  });

  it('should not transform livellm blocks that already exist', () => {
    const md = `\`\`\`livellm:alert
{"type":"info","text":"existing"}
\`\`\``;

    const result = transformer.transform(md);
    // The code detector should skip livellm: blocks
    expect(result).toBe(md);
  });
});
