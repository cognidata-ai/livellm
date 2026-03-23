# inline

## Purpose
Seven inline Web Components for LiveLLM that render lightweight, text-flow-compatible UI elements alongside LLM-generated content. Each component renders into Shadow DOM, accepts JSON props via `data-props`, and is designed for `display: inline` or `display: inline-flex` so they embed naturally within prose.

## Key Components
- **LiveLLMAlert** — block-level contextual message with type variants (info, success, warning, error), left border accent, and emoji icon
- **LiveLLMBadge** — small labeled pill with 6 color options and solid/outline variants
- **LiveLLMCounter** — numeric display with optional label, prefix, suffix, and three formats (number, compact, percent)
- **LiveLLMProgress** — horizontal bar with fill percentage, optional label, and configurable color
- **LiveLLMRating** — star display (filled/half/empty) with optional numeric value label
- **LiveLLMTag** — renders one or more tag pills from an array; supports per-tag color/icon, outline variant, and clickable mode (emits `tag-click` action)
- **LiveLLMTooltip** — hover tooltip with dashed underline trigger; popup positioned above via absolute CSS

## Exports / Public Interface
Each file exports two things:
- A named class (e.g. `LiveLLMAlert`) extending `LiveLLMComponent`
- A `*_REGISTRATION` constant (`RegisterOptions`) with JSON schema, category `'inline'`, and skeleton HTML/height for streaming placeholders

## Dependencies
- `../base` — `LiveLLMComponent` base class (Shadow DOM, `setStyles`, `setContent`, `emitAction`)
- `../../core/registry` — `RegisterOptions` type for schema declaration

No runtime dependencies beyond the base class.

## Notes
- All components implement their own `escapeHtml` helper (not shared) — minor duplication
- `LiveLLMTag` is the only inline component that emits actions (`tag-click` via `emitAction`)
- `LiveLLMAlert` uses `display: block` via `:host`, making it technically block-level despite being in the `inline/` category
- Skeleton definitions are minimal fixed-size placeholders for use by `StreamRenderer` during token streaming
- CSS theming uses `--livellm-*` custom properties throughout for consistent theming across the system