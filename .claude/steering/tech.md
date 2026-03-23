# Tech Stack

## Languages & Frameworks
- **TypeScript** — primary source language
- **Web Components (Custom Elements v1)** — all UI components use native Shadow DOM, no framework
- **markdown-it v14** — sole production dependency; extended with a custom plugin for `livellm:` fenced blocks
- **CSS Custom Properties** — design system via `--livellm-*` tokens across three themes (default, dark, minimal)
- **Rollup** — bundler producing UMD, ESM, and CJS outputs
- **Vitest + happy-dom** — test runner and browser-like DOM environment

## Infrastructure
- **OpenStreetMap** (iframe embed) — map component; no API key required
- **YouTube / Vimeo** (iframe embed) — video component; no API key required
- **SSE (Server-Sent Events)** — streaming protocol; client/server helpers in `src/protocol/`
- **WebSocket** — alternate streaming transport supported by StreamRenderer adapters
- **npm** — package registry target (`livellm`, v0.1.0)

## Key Constraints
- **Zero runtime dependencies** beyond `markdown-it` v14 — no React, Vue, or other framework required
- **Framework-agnostic** — integrates with any host via standard Custom Elements and CustomEvent API
- **ESM-first** with CJS and UMD (minified) fallbacks; all outputs include source maps
- **Shadow DOM (open mode)** — components are style-isolated; theming crosses the boundary only via CSS custom properties
- **One-shot action pattern** — action components lock after a single submission; no undo
- **Coverage thresholds** — 80% statements/functions/lines, 75% branches enforced in CI
- **Path alias** `@livellm/*` → `src/*` required in both `tsconfig` and Vitest config