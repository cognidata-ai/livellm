# root

## Purpose
The `src/themes/` directory provides the visual design system for LiveLLM via three CSS theme files. Each theme defines the full set of `--livellm-*` CSS custom properties consumed by all components and prose rendering, plus shared utility class styles (skeleton, fallback, error, stream cursor). Themes are swapped by loading the corresponding CSS file.

## Key Components
- `default.css` — Light theme with purple primary (`#6c5ce7`), white backgrounds, full typography system including prose, spacing, shadows, transitions, and all utility classes (skeleton, error, fallback, stream cursor, animations)
- `dark.css` — Dark theme override (`#1a1a2e` bg family, `#a29bfe` primary) that redefines color tokens and adds a few dark-specific prose tweaks (table row hover, mark highlights, image shadows)
- `minimal.css` — Monochrome theme (greyscale, `#333333` primary) with simplified aesthetics: no shadows, flat borders, left-aligned prose, no decorative blockquote quote mark, no hr ornament

## Exports / Public Interface
CSS custom properties on `:root`, consumed globally:
- Color tokens: `--livellm-primary[-light/-dark]`, `--livellm-success/warning/danger/info`
- Surface tokens: `--livellm-bg[-secondary/-component]`
- Text tokens: `--livellm-text[-secondary/-muted]`
- Border/radius/shadow/spacing/transition tokens
- Prose-specific tokens: `--livellm-prose-*`, `--livellm-heading-*`, `--livellm-blockquote-*`, `--livellm-code-*`, `--livellm-link-*`
- Skeleton tokens: `--livellm-skeleton-bg/shimmer`

Utility classes (defined only in `default.css`, inherited by all themes): `.livellm-fallback`, `.livellm-error`, `.livellm-skeleton`, `.livellm-cursor`, `.livellm-stream-block`, `.livellm-prose` (full markdown typography)

## Dependencies
Pure CSS — no imports or JavaScript dependencies. Consumed by Shadow DOM components via `getThemeVar()` and by the renderer which attaches `.livellm-prose` to rendered markdown output.

## Notes
- `default.css` is the base; `dark.css` and `minimal.css` only override what differs — both assume `default.css` utility classes are already present
- `.livellm-prose` in `default.css` is a comprehensive typography system: custom bullet/number rendering via `::before` pseudo-elements, nested list depth styles, justified text with hyphenation, lead paragraph styling after `h1/h2`
- Skeleton shimmer uses a CSS `translateX` animation (not opacity) for a sweep effect
- All color values have hardcoded fallbacks inline (e.g., `var(--livellm-primary, #6c5ce7)`) to work even without the theme file loaded