/**
 * LiveLLM — Bring LLM responses to life.
 *
 * Interactive components for LLM responses.
 * Extends Markdown with Web Components.
 */

export { LiveLLMInstance } from './core/livellm';
export { EventBus } from './core/events';
export { Registry } from './core/registry';
export { Parser } from './core/parser';
export { Renderer } from './core/renderer';
export { Transformer } from './core/transformer';
export { Actions } from './core/actions';
export { StreamRenderer } from './core/stream-renderer';
export { Observer } from './core/observer';
export { LiveLLMComponent } from './components/base';

// Built-in detectors
export {
  builtInDetectors,
  tableDetector,
  questionDetector,
  addressDetector,
  codeDetector,
  linkDetector,
  listDetector,
  dataDetector,
} from './detectors/index';

// Protocol — server ↔ client contract
export {
  // Types
  type UsageInfo,
  type TokenEvent,
  type ErrorEvent,
  type MetadataEvent,
  type DoneEvent,
  type StreamEvent,
  type StreamEventType,
  type LiveLLMResponse,
  type LiveLLMActionPayload,
  type LiveLLMChatRequest,
  type SSEWritable,
  type SSEWriter,
  type StreamRendererLike,
  type ConnectStreamOptions,
  // Type guards
  isStreamEvent,
  isTokenEvent,
  isErrorEvent,
  isMetadataEvent,
  isDoneEvent,
  // Server helpers
  createSSEWriter,
  formatActionAsMessage,
  // Client helpers
  parseSSEData,
  parseSSELine,
  connectLiveLLMStream,
} from './protocol/index';

// Re-export types
export type {
  LiveLLMConfig,
  LiveLLMAction,
  ComponentRegistration,
  ComponentSchema,
  SchemaProperty,
  ValidationResult,
  ValidationError,
  TransformerConfig,
  DetectorDefinition,
  DetectionMatch,
  StreamRendererOptions,
  StreamState,
  ComponentCategory,
  ThemeName,
} from './utils/types';

export type { ObserverOptions } from './core/observer';

// Built-in components — Inline
export { LiveLLMAlert } from './components/inline/alert';
export { LiveLLMBadge } from './components/inline/badge';
export { LiveLLMProgress } from './components/inline/progress';
export { LiveLLMTooltip } from './components/inline/tooltip';
export { LiveLLMRating } from './components/inline/rating';
export { LiveLLMCounter } from './components/inline/counter';
export { LiveLLMTag } from './components/inline/tag';

// Built-in components — Block
export { LiveLLMTabs } from './components/block/tabs';
export { LiveLLMMap } from './components/block/map';
export { LiveLLMChart } from './components/block/chart';
export { LiveLLMForm } from './components/block/form';
export { LiveLLMTablePlus } from './components/block/table-plus';
export { LiveLLMAccordion } from './components/block/accordion';
export { LiveLLMSteps } from './components/block/steps';
export { LiveLLMTimeline } from './components/block/timeline';
export { LiveLLMVideo } from './components/block/video';
export { LiveLLMPricing } from './components/block/pricing';
export { LiveLLMCarousel } from './components/block/carousel';
export { LiveLLMFilePreview } from './components/block/file-preview';
export { LiveLLMCalendar } from './components/block/calendar';
export { LiveLLMLinkPreview } from './components/block/link-preview';
export { LiveLLMCodeRunner } from './components/block/code-runner';

// Action components
export { LiveLLMChoice } from './components/action/choice';
export { LiveLLMConfirm } from './components/action/confirm';
export { LiveLLMMultiChoice } from './components/action/multi-choice';
export { LiveLLMRatingInput } from './components/action/rating-input';
export { LiveLLMDatePicker } from './components/action/date-picker';
export { LiveLLMTextInput } from './components/action/text-input';
export { LiveLLMSlider } from './components/action/slider';
export { LiveLLMFileUpload } from './components/action/file-upload';

import { LiveLLMInstance } from './core/livellm';

// Default singleton instance
const LiveLLM = new LiveLLMInstance();

// Auto-register built-in components — Inline
import { LiveLLMAlert, ALERT_REGISTRATION } from './components/inline/alert';
import { LiveLLMBadge, BADGE_REGISTRATION } from './components/inline/badge';
import { LiveLLMProgress, PROGRESS_REGISTRATION } from './components/inline/progress';
import { LiveLLMTooltip, TOOLTIP_REGISTRATION } from './components/inline/tooltip';
import { LiveLLMRating, RATING_REGISTRATION } from './components/inline/rating';
import { LiveLLMCounter, COUNTER_REGISTRATION } from './components/inline/counter';
import { LiveLLMTag, TAG_REGISTRATION } from './components/inline/tag';

// Auto-register built-in components — Block
import { LiveLLMTabs, TABS_REGISTRATION } from './components/block/tabs';
import { LiveLLMMap, MAP_REGISTRATION } from './components/block/map';
import { LiveLLMChart, CHART_REGISTRATION } from './components/block/chart';
import { LiveLLMForm, FORM_REGISTRATION } from './components/block/form';
import { LiveLLMTablePlus, TABLE_PLUS_REGISTRATION } from './components/block/table-plus';
import { LiveLLMAccordion, ACCORDION_REGISTRATION } from './components/block/accordion';
import { LiveLLMSteps, STEPS_REGISTRATION } from './components/block/steps';
import { LiveLLMTimeline, TIMELINE_REGISTRATION } from './components/block/timeline';
import { LiveLLMVideo, VIDEO_REGISTRATION } from './components/block/video';
import { LiveLLMPricing, PRICING_REGISTRATION } from './components/block/pricing';
import { LiveLLMCarousel, CAROUSEL_REGISTRATION } from './components/block/carousel';
import { LiveLLMFilePreview, FILE_PREVIEW_REGISTRATION } from './components/block/file-preview';
import { LiveLLMCalendar, CALENDAR_REGISTRATION } from './components/block/calendar';
import { LiveLLMLinkPreview, LINK_PREVIEW_REGISTRATION } from './components/block/link-preview';
import { LiveLLMCodeRunner, CODE_RUNNER_REGISTRATION } from './components/block/code-runner';

// Auto-register built-in components — Action
import { LiveLLMChoice, CHOICE_REGISTRATION } from './components/action/choice';
import { LiveLLMConfirm, CONFIRM_REGISTRATION } from './components/action/confirm';
import { LiveLLMMultiChoice, MULTI_CHOICE_REGISTRATION } from './components/action/multi-choice';
import { LiveLLMRatingInput, RATING_INPUT_REGISTRATION } from './components/action/rating-input';
import { LiveLLMDatePicker, DATE_PICKER_REGISTRATION } from './components/action/date-picker';
import { LiveLLMTextInput, TEXT_INPUT_REGISTRATION } from './components/action/text-input';
import { LiveLLMSlider, SLIDER_REGISTRATION } from './components/action/slider';
import { LiveLLMFileUpload, FILE_UPLOAD_REGISTRATION } from './components/action/file-upload';

// Register inline components
LiveLLM.register('alert', LiveLLMAlert, ALERT_REGISTRATION);
LiveLLM.register('badge', LiveLLMBadge, BADGE_REGISTRATION);
LiveLLM.register('progress', LiveLLMProgress, PROGRESS_REGISTRATION);
LiveLLM.register('tooltip', LiveLLMTooltip, TOOLTIP_REGISTRATION);
LiveLLM.register('rating', LiveLLMRating, RATING_REGISTRATION);
LiveLLM.register('counter', LiveLLMCounter, COUNTER_REGISTRATION);
LiveLLM.register('tag', LiveLLMTag, TAG_REGISTRATION);

// Register block components
LiveLLM.register('tabs', LiveLLMTabs, TABS_REGISTRATION);
LiveLLM.register('map', LiveLLMMap, MAP_REGISTRATION);
LiveLLM.register('chart', LiveLLMChart, CHART_REGISTRATION);
LiveLLM.register('form', LiveLLMForm, FORM_REGISTRATION);
LiveLLM.register('table-plus', LiveLLMTablePlus, TABLE_PLUS_REGISTRATION);
LiveLLM.register('accordion', LiveLLMAccordion, ACCORDION_REGISTRATION);
LiveLLM.register('steps', LiveLLMSteps, STEPS_REGISTRATION);
LiveLLM.register('timeline', LiveLLMTimeline, TIMELINE_REGISTRATION);
LiveLLM.register('video', LiveLLMVideo, VIDEO_REGISTRATION);
LiveLLM.register('pricing', LiveLLMPricing, PRICING_REGISTRATION);
LiveLLM.register('carousel', LiveLLMCarousel, CAROUSEL_REGISTRATION);
LiveLLM.register('file-preview', LiveLLMFilePreview, FILE_PREVIEW_REGISTRATION);
LiveLLM.register('calendar', LiveLLMCalendar, CALENDAR_REGISTRATION);
LiveLLM.register('link-preview', LiveLLMLinkPreview, LINK_PREVIEW_REGISTRATION);
LiveLLM.register('code-runner', LiveLLMCodeRunner, CODE_RUNNER_REGISTRATION);

// Register action components
LiveLLM.register('choice', LiveLLMChoice, CHOICE_REGISTRATION);
LiveLLM.register('confirm', LiveLLMConfirm, CONFIRM_REGISTRATION);
LiveLLM.register('multi-choice', LiveLLMMultiChoice, MULTI_CHOICE_REGISTRATION);
LiveLLM.register('rating-input', LiveLLMRatingInput, RATING_INPUT_REGISTRATION);
LiveLLM.register('date-picker', LiveLLMDatePicker, DATE_PICKER_REGISTRATION);
LiveLLM.register('text-input', LiveLLMTextInput, TEXT_INPUT_REGISTRATION);
LiveLLM.register('slider', LiveLLMSlider, SLIDER_REGISTRATION);
LiveLLM.register('file-upload', LiveLLMFileUpload, FILE_UPLOAD_REGISTRATION);

export { LiveLLM };
export default LiveLLM;
