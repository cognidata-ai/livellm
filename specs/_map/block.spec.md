# block

## Purpose
The `block/` directory contains 15 block-level Web Components that render rich UI elements as discrete, card-like blocks within LLM response output. Each component is a Shadow DOM custom element that accepts JSON props via `data-props` and renders self-contained interactive UI.

## Key Components
- **LiveLLMAccordion** — Collapsible sections with exclusive/multi-open modes
- **LiveLLMCalendar** — Monthly calendar grid with event markers and event list
- **LiveLLMCarousel** — Slide deck with dot navigation and prev/next controls
- **LiveLLMChart** — Bar, pie, and line charts rendered via inline SVG; no external chart lib
- **LiveLLMCodeRunner** — Syntax-highlighted code block with copy button and simulated run output
- **LiveLLMFilePreview** — File metadata display with icon-by-extension, optional content preview, and download link
- **LiveLLMForm** — Dynamic form builder supporting text, select, textarea, and checkbox fields; submits via `emitAction`
- **LiveLLMLinkPreview** — URL card with title, description, thumbnail, and domain icon
- **LiveLLMMap** — OpenStreetMap iframe embed (no API key) with optional title/address header
- **LiveLLMPricing** — Side-by-side pricing tier cards with feature lists and CTA buttons
- **LiveLLMSteps** — Numbered process steps with completed/active/pending status and connector lines
- **LiveLLMTablePlus** — Sortable, searchable, paginated data table with row selection
- **LiveLLMTabs** — Tabbed content panels with horizontal tab strip
- **LiveLLMTimeline** — Vertical chronological event list with colored dots and connector lines
- **LiveLLMVideo** — Responsive 16:9 video embed supporting YouTube, Vimeo, and native `<video>`

## Exports / Public Interface
Each file exports one named class (e.g., `LiveLLMAccordion`). Components are registered in `src/index.ts` via the registry. Each exports a `registerOptions` object defining the component name and prop schema.

## Dependencies
- `../base` (`LiveLLMComponent`) — base class providing Shadow DOM, `setStyles()`, `setContent()`, `escapeHtml()`, `escapeAttr()`, `emitAction()`
- `../../core/registry` (`RegisterOptions`) — type import for registration metadata
- No external UI libraries; charts use raw SVG, maps use OpenStreetMap iframes

## Notes
- All styles use `--livellm-*` CSS custom properties for theming (default, dark, minimal)
- Props accept aliased keys (e.g., `slides || items || cards || pages`) for flexibility
- Interactive components (carousel, tabs, accordion, table) attach event listeners inside `render()` using Shadow DOM `querySelector`
- Chart renders entirely in SVG without canvas or third-party libs
- Video supports YouTube/Vimeo URL detection to generate embed URLs; falls back to native `<video>` for `.mp4/.webm/.ogg`