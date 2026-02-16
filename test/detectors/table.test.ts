import { describe, it, expect } from 'vitest';
import { tableDetector } from '../../src/detectors/table';

describe('Table Detector', () => {
  it('should detect a simple markdown table', () => {
    const md = `| Name | Age | City |
| --- | --- | --- |
| Alice | 30 | NYC |
| Bob | 25 | LA |
| Charlie | 35 | SF |`;

    const matches = tableDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.headers).toEqual(['Name', 'Age', 'City']);
    expect(matches[0].data.rows.length).toBe(3);
    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should not detect a table with fewer than 2 data rows', () => {
    const md = `| Name | Age |
| --- | --- |
| Alice | 30 |`;

    const matches = tableDetector.detect(md);
    expect(matches.length).toBe(0);
  });

  it('should detect column alignments', () => {
    const md = `| Left | Center | Right |
| :--- | :---: | ---: |
| a | b | c |
| d | e | f |`;

    const matches = tableDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.alignments).toEqual(['left', 'center', 'right']);
  });

  it('should detect numeric columns', () => {
    const md = `| Product | Price | Qty |
| --- | --- | --- |
| Widget | $10 | 5 |
| Gadget | $20 | 3 |
| Doohickey | $15 | 8 |`;

    const matches = tableDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.numericColumns).toContain(2); // Qty is numeric
  });

  it('should transform a table to livellm:table-plus', () => {
    const md = `| Name | Score |
| --- | --- |
| Alice | 95 |
| Bob | 87 |
| Charlie | 92 |`;

    const matches = tableDetector.detect(md);
    const result = tableDetector.transform(matches[0]);

    expect(result).toContain('livellm:table-plus');
    const json = JSON.parse(result.split('\n')[1]);
    expect(json.columns.length).toBe(2);
    expect(json.data.length).toBe(3);
    expect(json.columns[0].sortable).toBe(true);
  });

  it('should enable search for tables with 5+ rows', () => {
    const rows = Array.from({ length: 6 }, (_, i) => `| Item${i} | ${i * 10} |`).join('\n');
    const md = `| Name | Value |\n| --- | --- |\n${rows}`;

    const matches = tableDetector.detect(md);
    const result = tableDetector.transform(matches[0]);
    const json = JSON.parse(result.split('\n')[1]);
    expect(json.searchable).toBe(true);
  });

  it('should enable pagination for tables with 10+ rows', () => {
    const rows = Array.from({ length: 12 }, (_, i) => `| Item${i} | ${i * 10} |`).join('\n');
    const md = `| Name | Value |\n| --- | --- |\n${rows}`;

    const matches = tableDetector.detect(md);
    const result = tableDetector.transform(matches[0]);
    const json = JSON.parse(result.split('\n')[1]);
    expect(json.paginate).toBe(true);
    expect(json.pageSize).toBe(10);
  });

  it('should handle tables with surrounding text', () => {
    const md = `Here is some data:

| Name | Age |
| --- | --- |
| Alice | 30 |
| Bob | 25 |
| Charlie | 35 |

And some more text after.`;

    const matches = tableDetector.detect(md);
    expect(matches.length).toBe(1);

    // Check offsets
    const original = md.substring(matches[0].start, matches[0].end);
    expect(original).toContain('| Name | Age |');
    expect(original).toContain('| Charlie | 35 |');
  });

  it('should detect multiple tables in the same document', () => {
    const md = `## Table 1

| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |
| 5 | 6 |

## Table 2

| X | Y | Z |
| --- | --- | --- |
| a | b | c |
| d | e | f |`;

    const matches = tableDetector.detect(md);
    expect(matches.length).toBe(2);
  });

  it('should give higher confidence to consistent tables', () => {
    const md = `| A | B | C |
| --- | --- | --- |
| 1 | 2 | 3 |
| 4 | 5 | 6 |
| 7 | 8 | 9 |
| 10 | 11 | 12 |
| 13 | 14 | 15 |`;

    const matches = tableDetector.detect(md);
    expect(matches[0].confidence).toBeGreaterThan(0.8);
  });
});
