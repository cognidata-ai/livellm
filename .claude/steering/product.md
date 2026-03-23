# Product Context

## What is this project?

LiveLLM is a framework-agnostic JavaScript library that transforms plain LLM markdown responses into rich, interactive UI experiences using Web Components. It parses `livellm:` fenced code blocks and inline syntax, rendering them as self-contained Shadow DOM custom elements — charts, tables, forms, carousels, action widgets, and more — directly inside chat interfaces or any web application that displays LLM output. The library requires no framework, no external chart dependencies, and no API keys for most features.

## Who are the users?

- **Application developers** integrating LLM-powered chat or assistant UIs into web products who want structured, interactive responses without building custom rendering pipelines.
- **LLM prompt engineers** authoring responses using `livellm:` syntax to produce guided, interactive output (forms, confirmations, ratings, etc.) that collects user input.
- **End users** of chat interfaces built with LiveLLM, who interact with the rendered components (clicking choices, filling forms, navigating carousels) without any awareness of the underlying library.

## Key goals

- **Enrich LLM output** — automatically detect and convert plain markdown patterns (tables, lists, URLs, code blocks) into interactive components with zero prompt changes required.
- **Collect structured user input** — provide one-shot action components (choice, confirm, date-picker, file-upload, slider, etc.) that lock after submission and emit typed events back to the host application.
- **Ensure visual isolation** — use Shadow DOM throughout so components render consistently regardless of the host page's CSS, with a theming system (`--livellm-*` custom properties) for customization.
- **Support streaming rendering** — handle token-by-token LLM output gracefully with skeleton placeholders, a char-level state machine, and RAF-batched DOM updates.
- **Stay dependency-light** — ship a single production dependency (`markdown-it`) with UMD, ESM, and CJS build targets so the library embeds easily in any stack.