export { tableDetector } from './table';
export { questionDetector } from './question';
export { addressDetector } from './address';
export { codeDetector } from './code';
export { linkDetector } from './link';
export { listDetector } from './list';
export { dataDetector } from './data';

import type { DetectorDefinition } from '../utils/types';
import { tableDetector } from './table';
import { questionDetector } from './question';
import { addressDetector } from './address';
import { codeDetector } from './code';
import { linkDetector } from './link';
import { listDetector } from './list';
import { dataDetector } from './data';

/**
 * All built-in detectors as a name→definition map.
 */
export const builtInDetectors: Record<string, DetectorDefinition> = {
  table: tableDetector,
  question: questionDetector,
  address: addressDetector,
  code: codeDetector,
  link: linkDetector,
  list: listDetector,
  data: dataDetector,
};
