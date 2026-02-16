import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Registry } from '../../src/core/registry';
import { Parser } from '../../src/core/parser';
import { Renderer } from '../../src/core/renderer';
import { Actions } from '../../src/core/actions';
import { LiveLLMChoice, CHOICE_REGISTRATION } from '../../src/components/action/choice';
import { LiveLLMConfirm, CONFIRM_REGISTRATION } from '../../src/components/action/confirm';
import { LiveLLMRatingInput, RATING_INPUT_REGISTRATION } from '../../src/components/action/rating-input';
import { LiveLLMSlider, SLIDER_REGISTRATION } from '../../src/components/action/slider';

// Register components
try { customElements.define('livellm-choice', LiveLLMChoice); } catch {}
try { customElements.define('livellm-confirm', LiveLLMConfirm); } catch {}
try { customElements.define('livellm-rating-input', LiveLLMRatingInput); } catch {}
try { customElements.define('livellm-slider', LiveLLMSlider); } catch {}

describe('Actions Pipeline Integration', () => {
  let events: EventBus;
  let registry: Registry;
  let parser: Parser;
  let renderer: Renderer;
  let actions: Actions;

  beforeEach(() => {
    events = new EventBus();
    registry = new Registry(events);
    parser = new Parser(events, registry);
    renderer = new Renderer(events, registry, parser);
    document.body.innerHTML = '<div id="app"></div>';

    // Register components
    registry.register('choice', LiveLLMChoice, CHOICE_REGISTRATION);
    registry.register('confirm', LiveLLMConfirm, CONFIRM_REGISTRATION);
    registry.register('rating-input', LiveLLMRatingInput, RATING_INPUT_REGISTRATION);
    registry.register('slider', LiveLLMSlider, SLIDER_REGISTRATION);
  });

  it('should render a choice component from markdown and capture actions', () => {
    const onAction = vi.fn();
    actions = new Actions(events, { onAction, autoSend: true });

    const md = '```livellm:choice\n{"question":"Pick one","options":[{"label":"A","value":"a"},{"label":"B","value":"b"}]}\n```';
    const container = renderer.render(md, '#app');

    expect(container).toBeTruthy();
    const choiceEl = container!.querySelector('livellm-choice');
    expect(choiceEl).toBeTruthy();
  });

  it('should render a confirm component from markdown', () => {
    const onAction = vi.fn();
    actions = new Actions(events, { onAction, autoSend: true });

    const md = '```livellm:confirm\n{"text":"Continue?","confirmLabel":"Yes","cancelLabel":"No"}\n```';
    const container = renderer.render(md, '#app');

    const confirmEl = container!.querySelector('livellm-confirm');
    expect(confirmEl).toBeTruthy();
  });

  it('should render a rating component from markdown', () => {
    const onAction = vi.fn();
    actions = new Actions(events, { onAction, autoSend: true });

    const md = '```livellm:rating-input\n{"label":"Rate this","max":5}\n```';
    const container = renderer.render(md, '#app');

    const ratingEl = container!.querySelector('livellm-rating-input');
    expect(ratingEl).toBeTruthy();
  });

  it('should route actions through the Actions module with autoSend', () => {
    const onAction = vi.fn();
    actions = new Actions(events, { onAction, autoSend: true });

    // Manually trigger an action event as if from a component
    events.emit('action:triggered', {
      type: 'livellm:action',
      component: 'choice',
      action: 'choice-select',
      value: 'option-a',
      label: 'Selected: Option A',
      metadata: {
        componentId: 'test-123',
        timestamp: Date.now(),
      },
    });

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction.mock.calls[0][0].component).toBe('choice');
    expect(onAction.mock.calls[0][0].value).toBe('option-a');
  });

  it('should emit preview event when autoSend is false', () => {
    const onPreview = vi.fn();
    actions = new Actions(events, { autoSend: false });
    events.on('action:previewing', onPreview);

    events.emit('action:triggered', {
      type: 'livellm:action',
      component: 'confirm',
      action: 'confirm-response',
      value: true,
      label: 'Confirmed',
      metadata: { componentId: 'test-456', timestamp: Date.now() },
    });

    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('should apply label templates to actions', () => {
    const onAction = vi.fn();
    actions = new Actions(events, {
      onAction,
      autoSend: true,
      labelTemplates: {
        'rating-input': (value: any) => `User rated ${value}/5 stars`,
      },
    });

    events.emit('action:triggered', {
      type: 'livellm:action',
      component: 'rating-input',
      action: 'rating-submit',
      value: 4,
      label: 'Rated: 4/5',
      metadata: { componentId: 'test-789', timestamp: Date.now() },
    });

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction.mock.calls[0][0].label).toBe('User rated 4/5 stars');
  });

  it('should handle the full action lifecycle: trigger → confirm → send', () => {
    const onAction = vi.fn();
    const onPreviewing = vi.fn();
    const onConfirmed = vi.fn();
    const onSent = vi.fn();

    actions = new Actions(events, { onAction, autoSend: false });

    events.on('action:previewing', onPreviewing);
    events.on('action:confirmed', onConfirmed);
    events.on('action:sent', onSent);

    const action = {
      type: 'livellm:action' as const,
      component: 'slider',
      action: 'slider-submit',
      value: 75,
      label: 'Selected: 75%',
      metadata: { componentId: 'test-abc', timestamp: Date.now() },
    };

    // Step 1: Trigger
    events.emit('action:triggered', action);
    expect(onPreviewing).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled(); // Not sent yet

    // Step 2: User confirms → send
    actions.send(action);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('should handle action cancellation', () => {
    const onCancelled = vi.fn();
    actions = new Actions(events, { autoSend: false });
    events.on('action:cancelled', onCancelled);

    const action = {
      type: 'livellm:action' as const,
      component: 'choice',
      action: 'choice-select',
      value: 'a',
      label: 'A',
      metadata: { componentId: 'test-def', timestamp: Date.now() },
    };

    actions.cancel(action);
    expect(onCancelled).toHaveBeenCalledTimes(1);
  });

  it('should render multiple action components in mixed content', () => {
    actions = new Actions(events, { autoSend: true });

    const md = `# Survey

Please answer the following:

\`\`\`livellm:choice
{"question":"Favorite framework?","options":[{"label":"React","value":"react"},{"label":"Vue","value":"vue"}]}
\`\`\`

\`\`\`livellm:rating-input
{"label":"How satisfied are you?","max":5}
\`\`\`

Thank you for your feedback!`;

    const container = renderer.render(md, '#app');
    expect(container).toBeTruthy();

    const choiceEl = container!.querySelector('livellm-choice');
    const ratingEl = container!.querySelector('livellm-rating-input');
    expect(choiceEl).toBeTruthy();
    expect(ratingEl).toBeTruthy();
  });
});
