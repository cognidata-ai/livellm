# Project Structure

## Directory layout

```
src/
├── index.ts                  # Singleton export; registers all 30 components
├── components/
│   ├── base.ts               # LiveLLMComponent base class (Shadow DOM, props, emitAction)
│   ├── block/                # 15 block-level components (card-like, full-width UI)
│   ├── inline/               # 7 inline components (text-flow-compatible)
│   └── action/               # 8 interactive input components (one-shot, lock on submit)
├── core/                     # Pipeline modules: parser, transformer, renderer, stream-renderer,
│   │                         # registry, events, actions, observer, livellm (facade)
├── detectors/                # 7 auto-transform detectors (table, question, address, etc.)
├── themes/                   # CSS design system (default.css, dark.css, minimal.css)
├── protocol/                 # SSE/streaming helpers (parseSSE, connectStream, createSSEWriter)
└── utils/                    # Types, validation, JSON parsing, DOM helpers, sanitization
```

## Conventions

- **Naming**: Classes prefixed `LiveLLM` (e.g. `LiveLLMChart`); registration constants suffixed `_REGISTRATION`; detector files named after the pattern they detect
- **Component anatomy**: Each component file exports one named class + one `RegisterOptions` constant containing JSON prop schema, category string, and skeleton placeholder HTML
- **Categories**: Components are tagged with one of three categories — `'block'`, `'inline'`, `'action'` — used by the registry
- **Base class**: All components extend `LiveLLMComponent` from `../base`; direct instantiation or DOM helpers are not used
- **Props**: Passed via `data-props` JSON attribute; validated against the component's JSON schema before render
- **Shadow DOM**: Every component uses open-mode Shadow DOM; styles use `--livellm-*` CSS custom properties; no external stylesheets imported into components
- **Actions**: Interactive components emit `livellm:action` CustomEvents with `{ value, label, ...extras }` — `bubbles: true, composed: true` to cross Shadow DOM boundaries
- **Theme system**: CSS custom properties defined on `:root` in theme files; `default.css` is the base layer; `dark.css` and `minimal.css` override tokens only
- **No shared utilities inside components**: Helpers like `escapeHtml` are duplicated per component rather than imported from a shared module
- **Single production dependency**: `markdown-it` v14; everything else (charts, maps via iframe) is implemented inline