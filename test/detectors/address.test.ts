import { describe, it, expect } from 'vitest';
import { addressDetector } from '../../src/detectors/address';

describe('Address Detector', () => {
  it('should detect a US street address', () => {
    const md = `Our office is at 123 Main Street, New York, NY 10001.`;

    const matches = addressDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.type).toBe('address');
    expect(matches[0].data.address).toContain('123 Main Street');
  });

  it('should detect abbreviated street addresses', () => {
    const md = `Send packages to 456 Oak Ave, Los Angeles, CA 90001.`;

    const matches = addressDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.address).toContain('456 Oak Ave');
  });

  it('should detect addresses with apartment numbers', () => {
    const md = `My address is 789 Pine Dr, Apt 4B, Chicago, IL 60601.`;

    const matches = addressDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.address).toContain('Apt 4B');
  });

  it('should detect coordinate pairs', () => {
    const md = `The location is at 40.7128, -74.0060.`;

    const matches = addressDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.type).toBe('coordinates');
    expect(matches[0].data.lat).toBeCloseTo(40.7128);
    expect(matches[0].data.lng).toBeCloseTo(-74.006);
  });

  it('should detect labeled coordinates', () => {
    const md = `lat: 51.5074, lng: -0.1278`;

    const matches = addressDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.lat).toBeCloseTo(51.5074);
  });

  it('should reject invalid coordinate ranges', () => {
    const md = `The values are 200.5, -300.2.`;

    const matches = addressDetector.detect(md);
    expect(matches.length).toBe(0);
  });

  it('should transform an address to livellm:map', () => {
    const md = `Visit us at 100 Broadway, New York, NY 10005.`;

    const matches = addressDetector.detect(md);
    const result = addressDetector.transform(matches[0]);

    expect(result).toContain('livellm:map');
    const json = JSON.parse(result.split('\n')[1]);
    expect(json.address).toContain('100 Broadway');
    expect(json.zoom).toBe(16);
  });

  it('should transform coordinates to livellm:map', () => {
    const md = `Location: 48.8566, 2.3522`;

    const matches = addressDetector.detect(md);
    const result = addressDetector.transform(matches[0]);

    expect(result).toContain('livellm:map');
    const json = JSON.parse(result.split('\n')[1]);
    expect(json.lat).toBeCloseTo(48.8566);
    expect(json.lng).toBeCloseTo(2.3522);
    expect(json.zoom).toBe(15);
  });

  it('should give higher confidence to coordinates than addresses', () => {
    const addrMd = `123 Main Street, Springfield, IL 62701`;
    const coordMd = `40.7128, -74.0060`;

    const addrMatches = addressDetector.detect(addrMd);
    const coordMatches = addressDetector.detect(coordMd);

    expect(coordMatches[0].confidence).toBeGreaterThan(addrMatches[0].confidence);
  });
});
