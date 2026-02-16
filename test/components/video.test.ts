import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMVideo, VIDEO_REGISTRATION } from '../../src/components/block/video';

const tagName = 'livellm-test-video';
try { customElements.define(tagName, LiveLLMVideo); } catch {}

function createVideo(props: Record<string, any>): LiveLLMVideo {
  const el = document.createElement(tagName) as LiveLLMVideo;
  el.setAttribute('data-livellm', 'video');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Video Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(VIDEO_REGISTRATION.schema.url).toBeDefined();
    expect(VIDEO_REGISTRATION.schema.url.required).toBe(true);
    expect(VIDEO_REGISTRATION.category).toBe('block');
  });

  it('should render YouTube embed for youtube URLs', () => {
    const el = createVideo({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    const shadow = el.shadowRoot!;
    const iframe = shadow.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.src).toContain('youtube.com/embed/dQw4w9WgXcQ');
  });

  it('should render YouTube embed for youtu.be short URLs', () => {
    const el = createVideo({
      url: 'https://youtu.be/dQw4w9WgXcQ',
    });
    const shadow = el.shadowRoot!;
    const iframe = shadow.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.src).toContain('youtube.com/embed/dQw4w9WgXcQ');
  });

  it('should render Vimeo embed for vimeo URLs', () => {
    const el = createVideo({
      url: 'https://vimeo.com/123456789',
    });
    const shadow = el.shadowRoot!;
    const iframe = shadow.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.src).toContain('player.vimeo.com/video/123456789');
  });

  it('should render native video for direct file URLs', () => {
    const el = createVideo({
      url: 'https://example.com/video.mp4',
    });
    const shadow = el.shadowRoot!;
    const video = shadow.querySelector('video');
    expect(video).toBeTruthy();
    const source = video?.querySelector('source');
    expect(source?.getAttribute('src')).toContain('video.mp4');
  });

  it('should render caption when provided', () => {
    const el = createVideo({
      url: 'https://www.youtube.com/watch?v=abc123',
      caption: 'My Video',
    });
    const shadow = el.shadowRoot!;
    const caption = shadow.querySelector('.video-caption');
    expect(caption?.textContent).toContain('My Video');
  });
});
