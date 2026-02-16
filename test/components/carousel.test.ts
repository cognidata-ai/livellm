import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMCarousel, CAROUSEL_REGISTRATION } from '../../src/components/block/carousel';

const tagName = 'livellm-test-carousel';
try { customElements.define(tagName, LiveLLMCarousel); } catch {}

function createCarousel(props: Record<string, any>): LiveLLMCarousel {
  const el = document.createElement(tagName) as LiveLLMCarousel;
  el.setAttribute('data-livellm', 'carousel');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Carousel Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(CAROUSEL_REGISTRATION.schema.slides).toBeDefined();
    expect(CAROUSEL_REGISTRATION.schema.slides.type).toBe('array');
    expect(CAROUSEL_REGISTRATION.category).toBe('block');
  });

  it('should render slides', () => {
    const el = createCarousel({
      slides: [
        { title: 'Slide 1', content: 'First slide content' },
        { title: 'Slide 2', content: 'Second slide content' },
        { title: 'Slide 3', content: 'Third slide content' },
      ],
    });
    const shadow = el.shadowRoot!;
    const slides = shadow.querySelectorAll('.carousel-slide');
    expect(slides.length).toBe(3);
  });

  it('should render all slides in carousel track', () => {
    const el = createCarousel({
      slides: [
        { title: 'First', content: 'Content 1' },
        { title: 'Second', content: 'Content 2' },
      ],
    });
    const shadow = el.shadowRoot!;
    const slides = shadow.querySelectorAll('.carousel-slide');
    expect(slides.length).toBe(2);
  });

  it('should render navigation dots', () => {
    const el = createCarousel({
      slides: [
        { title: 'A', content: 'a' },
        { title: 'B', content: 'b' },
        { title: 'C', content: 'c' },
      ],
    });
    const shadow = el.shadowRoot!;
    const dots = shadow.querySelectorAll('.carousel-dot');
    expect(dots.length).toBe(3);
  });

  it('should render prev/next buttons', () => {
    const el = createCarousel({
      slides: [
        { title: 'A', content: 'a' },
        { title: 'B', content: 'b' },
      ],
    });
    const shadow = el.shadowRoot!;
    const prevBtn = shadow.querySelector('.carousel-btn[data-dir="prev"]');
    const nextBtn = shadow.querySelector('.carousel-btn[data-dir="next"]');
    expect(prevBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();
  });

  it('should navigate to next slide on next button click', () => {
    const el = createCarousel({
      slides: [
        { title: 'First', content: 'c1' },
        { title: 'Second', content: 'c2' },
      ],
    });
    const shadow = el.shadowRoot!;
    const nextBtn = shadow.querySelector('.carousel-btn[data-dir="next"]') as HTMLElement;
    nextBtn?.click();
    // After clicking next, the second dot should become active
    const dots = shadow.querySelectorAll('.carousel-dot');
    expect(dots[1].classList.contains('active')).toBe(true);
    expect(dots[0].classList.contains('active')).toBe(false);
  });
});
