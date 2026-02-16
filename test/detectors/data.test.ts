import { describe, it, expect } from 'vitest';
import { dataDetector } from '../../src/detectors/data';

describe('Data Detector', () => {
  it('should detect key-value data with labels and numbers', () => {
    const md = `Performance Metrics:
- Revenue: 1,500,000
- Users: 50000
- Conversion Rate: 3.2%`;

    const matches = dataDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.points.length).toBe(3);
    expect(matches[0].data.points[0].label).toBe('Revenue');
    expect(matches[0].data.points[0].value).toBe(1500000);
  });

  it('should detect percentage data', () => {
    const md = `Market Share:
- Chrome: 65%
- Safari: 18%
- Firefox: 8%
- Edge: 5%`;

    const matches = dataDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.hasPercentages).toBe(true);
  });

  it('should detect colon-separated data without bullets', () => {
    const md = `Sales: 500
Costs: 200
Profit: 300`;

    const matches = dataDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.points.length).toBe(3);
  });

  it('should not detect fewer than 3 data points', () => {
    const md = `Revenue: 1000\nCosts: 500`;

    const matches = dataDetector.detect(md);
    expect(matches.length).toBe(0);
  });

  it('should detect time series data', () => {
    const md = `Revenue by year:
2020: 100
2021: 150
2022: 200
2023: 280`;

    const matches = dataDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.isTimeSeries).toBe(true);
  });

  it('should transform percentages to pie chart', () => {
    const md = `- Category A: 40%
- Category B: 35%
- Category C: 25%`;

    const matches = dataDetector.detect(md);
    const result = dataDetector.transform(matches[0]);

    expect(result).toContain('livellm:chart');
    const json = JSON.parse(result.split('\n')[1]);
    expect(json.type).toBe('pie');
    expect(json.labels).toEqual(['Category A', 'Category B', 'Category C']);
    expect(json.datasets[0].data).toEqual([40, 35, 25]);
  });

  it('should transform time series to line chart', () => {
    const md = `2020: 100
2021: 150
2022: 200`;

    const matches = dataDetector.detect(md);
    const result = dataDetector.transform(matches[0]);

    const json = JSON.parse(result.split('\n')[1]);
    expect(json.type).toBe('line');
  });

  it('should transform regular data to bar chart', () => {
    const md = `Product A: 500
Product B: 300
Product C: 700`;

    const matches = dataDetector.detect(md);
    const result = dataDetector.transform(matches[0]);

    const json = JSON.parse(result.split('\n')[1]);
    expect(json.type).toBe('bar');
    expect(json.labels).toEqual(['Product A', 'Product B', 'Product C']);
  });

  it('should handle bold labels', () => {
    const md = `**Revenue**: 1000
**Expenses**: 600
**Profit**: 400`;

    const matches = dataDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.points[0].label).toBe('Revenue');
  });

  it('should give higher confidence to percentage data', () => {
    const pctMd = `A: 40%\nB: 35%\nC: 25%`;
    const plainMd = `A: 40\nB: 35\nC: 25`;

    const pctMatches = dataDetector.detect(pctMd);
    const plainMatches = dataDetector.detect(plainMd);

    expect(pctMatches[0].confidence).toBeGreaterThan(plainMatches[0].confidence);
  });
});
