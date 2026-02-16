export { tableDetector } from './table';
export { questionDetector } from './question';
export { addressDetector } from './address';
export { codeDetector } from './code';
export { linkDetector } from './link';
export { listDetector } from './list';
export { dataDetector } from './data';
import type { DetectorDefinition } from '../utils/types';
/**
 * All built-in detectors as a name→definition map.
 */
export declare const builtInDetectors: Record<string, DetectorDefinition>;
