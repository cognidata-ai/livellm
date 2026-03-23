# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Rollup build → dist/ (UMD, ESM, CJS)
npm run dev            # Rollup watch mode
npm run test           # Vitest interactive (watch) mode
npm run test:run       # Vitest single run (CI)
npm run test:coverage  # Vitest with v8 coverage report
npm run lint           # ESLint on src/
npm run typecheck      # tsc --noEmit
```

Run a single test file:
```bash
npx vitest run test/core/parser.test.ts
```

## Architecture

### Core Pipeline

LLM markdown flows through: **Parser → Transformer → Renderer**

- **Parser** (`src/core/parser.ts`) — markdown-it with custom plugin that intercepts `livellm:component-name` fenced blocks and inline code, extracting JSON props
- **Transformer** (`src/core/transformer.ts`) — runs detectors over plain markdown to auto-convert patterns (tables, addresses, questions, URLs, code blocks, lists, data) into `livellm:` blocks. Resolves overlapping detections by confidence, applies in reverse position order
- **Renderer** (`src/core/renderer.ts`) — renders parsed HTML to DOM elements or HTML string
- **StreamRenderer** (`src/core/stream-renderer.ts`) — char-level state machine for token-by-token rendering with skeleton placeholders and RAF batching

### Facade

`LiveLLMInstance` (`src/core/livellm.ts`) orchestrates all core modules. The singleton `LiveLLM` is exported from `src/index.ts` with all 30 built-in components pre-registered.

### Supporting Modules

- **Registry** (`src/core/registry.ts`) — component registration + JSON schema prop validation
- **Events** (`src/core/events.ts`) — cross-cutting EventBus, all modules emit through it
- **Actions** (`src/core/actions.ts`) — bidirectional action routing: component → event → callback, with autoSend or preview→confirm flow
- **Observer** (`src/core/observer.ts`) — MutationObserver-based auto-processing of `livellm:` blocks in dynamic content

## Components

Three categories under `src/components/`: **block/** (15), **inline/** (7), **action/** (8).

All extend `LiveLLMComponent` (`src/components/base.ts`):
- Shadow DOM (open mode) for style isolation
- Props received via `data-props` JSON attribute
- `emitAction(action, data)` dispatches `livellm:action` CustomEvent (`bubbles: true, composed: true` to cross Shadow DOM boundaries)
- `getThemeVar(name, fallback)` reads CSS custom properties
- `setStyles(css)` injects CSS into Shadow DOM

## Detectors

Located in `src/detectors/`. Each implements `DetectorDefinition`: `detect()` returns `DetectionMatch[]` with confidence scores, `transform()` converts matched text to `livellm:` block syntax.

Built-in: table, question, address, code, link, list, data.

## Testing

- **Vitest + happy-dom** — test files in `test/**/*.test.ts`
- Vitest globals enabled (`describe`, `it`, `expect`, `vi`, `beforeEach` available without import)
- **Known noise**: happy-dom's CustomElementRegistry reuses across tests, producing stderr warnings about duplicate registrations. These are not errors.
- Coverage thresholds: 80% statements/functions/lines, 75% branches

## Key Conventions

- **Path alias**: `@livellm/*` maps to `src/*` (tsconfig + vitest config)
- **Themes**: CSS custom properties prefixed `--livellm-` (primary, bg, text, border, font, etc.) in `src/themes/` (default, dark, minimal)
- **Build outputs**: UMD (`livellm.min.js`, minified), ESM (`livellm.esm.js`), CJS (`livellm.cjs.js`) — all with source maps
- **Single production dependency**: `markdown-it` v14
- **SSE Protocol**: `src/protocol/` has client/server helpers for streaming (parseSSE, connectStream, createSSEWriter)

## Existing Documentation

- `LIVELLM.md` — Full API reference, architecture deep-dive, protocol spec
- `COMPONENTS.md` — Detailed props and usage for all 30 components
- `SKILL.md` — Guide for LLM assistants on writing LiveLLM-compatible markdown

<!-- sdd-kit:start -->
## SDD (Spec-Driven Development)

This project uses [sdd-kit](https://github.com/Curbeloi/sdd-kit) for spec-driven development.

### Documentation structure
- `.claude/steering/` — Project context (product, tech stack, structure)
- `specs/features/` — Feature specs (requirements, design, tasks)
- `specs/_map/` — Living project map (auto-generated)
- `specs/_arch/` — Architecture views and dashboard

### Commands reference

#### Spec creation
- `sdd spec create "feature"` — Scaffold spec files (empty with header)
  - `-1` tasks.md only (bug fixes, tweaks)
  - `-2` requirements.md + tasks.md (clear features, 1-3 days)
  - `-3` full spec: requirements + design + tasks (default)
  - `-n, --name <name>` custom spec name
- `sdd spec create --name feat-my-feature` — Create without description

#### Spec execution
- `sdd spec execute <spec-name>` — Execute next pending task via Claude Code
  - `-t, --task <id>` execute a specific task (e.g. `--task 1.2`)
  - `--dry-run` preview what would be done without executing
  - `-p, --prompt-only` generate prompt without executing

#### Code documentation
- `sdd spec document <path>` — Reverse engineer existing code into a spec
  - `-n, --name <name>` custom spec name
  - `-p, --prompt-only` save prompt instead of invoking Claude Code

#### Project overview
- `sdd spec status` — Show project progress across all specs
  - `sdd spec status <spec-name> --verbose` — Show individual task details
- `sdd spec refresh` — Update project map specs (living documentation)
  - `sdd spec refresh <dir>` — Refresh a specific directory

#### Spec lifecycle
- `sdd spec list` — List all specs with progress summary
- `sdd spec delete <name>` — Delete a spec (`--force` to skip confirmation)
- `sdd spec rename <old> <new>` — Rename a spec and update headers
- `sdd spec archive <name>` — Archive a spec (`--restore` to bring it back)

#### Architecture
- `sdd arch` — Generate architecture views and dashboard
  - `-l, --level <level>` system | services | modules
  - `-f, --flow <feature>` show flow diagram for a specific feature

#### Configuration
- `sdd config` — Show active configuration (defaults + .sddrc overrides)

#### Setup
- `sdd init` — Initialize sdd-kit in project (creates steering docs + CLAUDE.md)
  - `--auto` auto-generate steering from map specs

### Workflow
1. `sdd init` — Set up project structure
2. `sdd spec document src/` — Map existing code into specs
3. `sdd spec create "feature"` — Plan a new feature
4. Fill the spec files with your AI assistant
5. `sdd spec execute feat-x` — Build tasks one by one
6. `sdd spec status` — Track progress
7. `sdd arch` — Visualize architecture

### When working on this project
- Read relevant specs in `specs/features/` before implementing features
- Check `.claude/steering/` for project context and conventions
- After completing tasks, they are auto-marked in `tasks.md`
<!-- sdd-kit:end -->
