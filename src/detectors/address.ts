import type { DetectorDefinition, DetectionMatch } from '../utils/types';

/**
 * Address Detector — Detects physical addresses and transforms them
 * into livellm:map components using OpenStreetMap.
 */

// Common address patterns
// "123 Main St, City, State ZIP"
// "123 Main Street, Apt 4B, City, ST 12345"
// Street address with city, state, zip
const US_ADDRESS_RE = /\d{1,5}\s+[\w\s.]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Circle|Cir|Trail|Trl|Parkway|Pkwy|Highway|Hwy)\.?(?:\s*,?\s*(?:Apt|Suite|Ste|Unit|#)\s*[\w-]+)?\s*,\s*[\w\s]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/gi;

// International-style: "Street Name Number, Postal Code City, Country"
const INTL_ADDRESS_RE = /[\w\s.]+\d{1,5}\s*,\s*\d{4,6}\s+[\w\s]+,\s*[\w\s]+/gi;

// Location with coordinates: "lat: 40.7128, lng: -74.0060" or "(40.7128, -74.0060)"
const COORDS_RE = /(?:(?:lat(?:itude)?|location)\s*[:=]\s*)?(-?\d{1,3}\.\d{3,})\s*,\s*(?:(?:lng|lon(?:gitude)?)\s*[:=]\s*)?(-?\d{1,3}\.\d{3,})/gi;

function findAddresses(markdown: string): DetectionMatch[] {
  const matches: DetectionMatch[] = [];
  const seen = new Set<string>(); // Avoid duplicate overlapping matches

  // Look for US-style addresses
  let m: RegExpExecArray | null;
  US_ADDRESS_RE.lastIndex = 0;
  while ((m = US_ADDRESS_RE.exec(markdown)) !== null) {
    const key = `${m.index}:${m.index + m[0].length}`;
    if (seen.has(key)) continue;
    seen.add(key);

    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      data: {
        address: m[0].trim(),
        type: 'address',
      },
      confidence: 0.85,
      apply: () => {},
    });
  }

  // Look for coordinate pairs
  COORDS_RE.lastIndex = 0;
  while ((m = COORDS_RE.exec(markdown)) !== null) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);

    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const key = `${m.index}:${m.index + m[0].length}`;
    if (seen.has(key)) continue;
    seen.add(key);

    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      data: {
        lat,
        lng,
        type: 'coordinates',
      },
      confidence: 0.9,
      apply: () => {},
    });
  }

  return matches;
}

export const addressDetector: DetectorDefinition = {
  detect(markdown: string): DetectionMatch[] {
    return findAddresses(markdown);
  },

  transform(match: DetectionMatch): string {
    if (match.data.type === 'coordinates') {
      const props = {
        lat: match.data.lat,
        lng: match.data.lng,
        zoom: 15,
        title: `Location (${match.data.lat}, ${match.data.lng})`,
      };
      return '```livellm:map\n' + JSON.stringify(props) + '\n```';
    }

    // For text addresses, we encode the address for OSM search
    const props = {
      address: match.data.address,
      zoom: 16,
      title: match.data.address,
    };
    return '```livellm:map\n' + JSON.stringify(props) + '\n```';
  },
};
