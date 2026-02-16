# LiveLLM

**Framework-agnostic library that transforms LLM responses into interactive UIs — real-time streaming, 30 Web Components, auto-detection of markdown patterns, and a typed SSE protocol.**

[![npm version](https://img.shields.io/npm/v/livellm.svg)](https://www.npmjs.com/package/livellm)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-424%20passing-brightgreen.svg)]()

---

## What is LiveLLM?

LiveLLM takes Markdown from any LLM and renders it as rich, interactive UI using Web Components. It works three ways:

1. **Auto-detection** — The built-in Transformer scans plain Markdown for patterns (tables, questions, data, links, etc.) and upgrades them to interactive components. Your LLM writes normal Markdown; LiveLLM does the rest.
2. **Explicit syntax** — Use `` `livellm:component{json}` `` for precise control over what renders.
3. **Streaming** — Token-by-token rendering with skeleton placeholders and a char-level state machine. No flicker, no layout shift.

No framework dependency. No virtual DOM. Just Web Components that work everywhere.

---

## Key Features

- **30 interactive components** — Charts, tables, forms, carousels, timelines, and more
- **Streaming-first** — Char-level state machine with skeleton placeholders and RAF batching
- **Auto-detection** — 7 built-in detectors transform plain Markdown into rich components
- **Bidirectional actions** — Components send user choices back to your app (choice, confirm, rating, slider, etc.)
- **Typed SSE protocol** — Standardized server-client contract with metadata, errors, and action feedback
- **Framework-agnostic** — Works with React, Vue, Svelte, vanilla JS, or any framework
- **Themes** — Default, dark, and minimal themes via CSS custom properties
- **Python SDK** — Server-side helpers for FastAPI and any Python backend

---

## Quick Start

### CDN

```html
<script src="https://unpkg.com/livellm/dist/livellm.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/livellm/src/themes/default.css">

<div id="output"></div>
<script>
  LiveLLM.render('## Hello\n\n| Name | Score |\n|------|-------|\n| Alice | 95 |\n| Bob | 87 |', '#output');
</script>
```

### npm

```bash
npm install livellm
```

```js
import LiveLLM from 'livellm';
import 'livellm/themes/default.css';

LiveLLM.init({ transformer: { mode: 'auto' } });
LiveLLM.render(markdown, '#output');
```

---

## Usage

### Static Rendering

```js
const markdown = `
## Sales Report

| Product | Q1 | Q2 | Q3 |
|---------|-----|-----|-----|
| Alpha   | 120 | 150 | 180 |
| Beta    | 80  | 95  | 110 |

What would you like to do next?
1. Export to CSV
2. View charts
3. Send report
`;

LiveLLM.render(markdown, '#output');
// The table becomes a sortable/searchable livellm-table-plus
// The numbered list becomes a clickable livellm-choice
```

### Streaming

```js
import { connectLiveLLMStream } from 'livellm';

const sr = LiveLLM.createStreamRenderer('#output', {
  autoScroll: true,
  showCursor: true,
  onEnd: (fullText) => {
    // Re-render with Transformer for interactive components
    LiveLLM.render(fullText, '#output');
  },
});

const response = await fetch('/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Show me the sales data' }),
});

await connectLiveLLMStream(response, sr, {
  onMetadata: (meta) => console.log('Model:', meta.model),
  onError: (err) => console.error(err.message),
});
```

### Explicit Components

```js
const markdown = `
Here are your options:

\`\`\`livellm:choice
{"question": "Which framework?", "options": ["React", "Vue", "Svelte"]}
\`\`\`

Progress: \`livellm:progress{"value": 72, "label": "72% complete"}\`
`;

LiveLLM.render(markdown, '#output');

// Listen for user interactions
LiveLLM.on('action:triggered', (action) => {
  console.log(action.component, action.value); // "choice", "React"
});
```

---

## Components

### Block Components (15)

| Component | Description |
|-----------|-------------|
| `tabs` | Tabbed content panels |
| `chart` | Bar, line, pie, doughnut, area, radar, scatter charts |
| `table-plus` | Sortable, searchable, paginated tables |
| `form` | Dynamic forms with field validation |
| `accordion` | Collapsible content sections |
| `steps` | Step-by-step progress indicators |
| `timeline` | Chronological event display |
| `carousel` | Image/content slideshow |
| `pricing` | Pricing tier comparison cards |
| `map` | Interactive maps with markers |
| `video` | Embedded video (YouTube, Vimeo, direct) |
| `calendar` | Monthly calendar with events |
| `file-preview` | File content preview |
| `link-preview` | URL preview cards |
| `code-runner` | Executable code blocks |

### Inline Components (7)

| Component | Description |
|-----------|-------------|
| `alert` | Info, warning, error, success alerts |
| `badge` | Colored status badges |
| `progress` | Progress bars with percentage |
| `tooltip` | Hover tooltips |
| `rating` | Star rating display |
| `counter` | Numeric counters with +/- controls |
| `tag` | Colored tags/labels |

### Action Components (8)

| Component | Description |
|-----------|-------------|
| `choice` | Single-select option buttons |
| `multi-choice` | Multi-select checkboxes |
| `confirm` | Yes/No confirmation |
| `rating-input` | Interactive star rating input |
| `text-input` | Text input with validation |
| `slider` | Range slider input |
| `date-picker` | Date selection |
| `file-upload` | File upload with drag & drop |

---

## Framework Integration

### React

```tsx
import { useEffect, useRef } from 'react';
import LiveLLM from 'livellm';
import 'livellm/themes/default.css';

function Chat() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    LiveLLM.init({ transformer: { mode: 'auto' } });
    LiveLLM.on('action:triggered', (action) => {
      console.log('User action:', action);
    });
  }, []);

  return <div ref={ref} className="livellm-output" />;
}
```

### Vue

```vue
<template>
  <div ref="output" />
</template>

<script setup>
import { ref, onMounted } from 'vue';
import LiveLLM from 'livellm';
import 'livellm/themes/default.css';

const output = ref(null);

onMounted(() => {
  LiveLLM.init({ transformer: { mode: 'auto' } });
  LiveLLM.render(markdown, output.value);
});
</script>
```

### Svelte

```svelte
<script>
  import { onMount } from 'svelte';
  import LiveLLM from 'livellm';
  import 'livellm/themes/default.css';

  let target;

  onMount(() => {
    LiveLLM.init({ transformer: { mode: 'auto' } });
    LiveLLM.render(markdown, target);
  });
</script>

<div bind:this={target}></div>
```

See the [examples/](examples/) directory for complete working examples.

---

## Themes

```js
// Import a theme
import 'livellm/themes/default.css';  // Light theme
import 'livellm/themes/dark.css';     // Dark theme
import 'livellm/themes/minimal.css';  // Minimal theme

// Or configure on init
LiveLLM.init({ theme: 'dark' });
```

All components use CSS custom properties for full customization.

---

## Server Protocol

LiveLLM includes a typed SSE protocol for standardized server-client communication:

```
data: {"type":"metadata","model":"llama-3.3-70b","provider":"groq"}
data: {"type":"token","token":"Hello"}
data: {"type":"token","token":" world"}
data: {"type":"metadata","usage":{"prompt_tokens":100,"completion_tokens":5,"total_tokens":105},"latency_ms":250}
data: {"type":"done","fullText":"Hello world"}
```

**Server helpers** (Node.js):

```js
import { createSSEWriter } from 'livellm';

const sse = createSSEWriter(res);
sse.writeHeaders();
sse.metadata({ model: 'gpt-4', provider: 'openai' });
sse.token('Hello');
sse.token(' world');
sse.done('Hello world');
```

**Client helpers**:

```js
import { connectLiveLLMStream } from 'livellm';

await connectLiveLLMStream(response, streamRenderer, {
  onMetadata: (meta) => { /* model, provider, usage, latency */ },
  onError: (err) => { /* code, message, recoverable */ },
});
```

See [LIVELLM.md](LIVELLM.md#server-protocol) for the full protocol specification.

---

## Python SDK

For FastAPI and other Python backends, use the companion [livellm-python](https://github.com/cognidata/livellm-python) package:

```bash
pip install livellm
```

```python
from fastapi.responses import StreamingResponse
from livellm import livellm_sse_generator, livellm_stream_headers, chart, inject

# SSE streaming with the LiveLLM protocol
@app.post("/api/chat/stream")
async def stream(message: str):
    tokens = my_llm.stream(message)
    return StreamingResponse(
        livellm_sse_generator(tokens, model="llama-3.3-70b", provider="groq"),
        headers=livellm_stream_headers(),
    )

# Generate component blocks from backend data
md = "## Report"
block = chart(labels=["Q1", "Q2"], datasets=[{"data": [100, 150]}])
result = inject(md, block)  # Markdown with embedded livellm:chart block
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [LIVELLM.md](LIVELLM.md) | Complete API reference, architecture, transformer pipeline, streaming, actions, protocol |
| [COMPONENTS.md](COMPONENTS.md) | Detailed props and usage for all 30 components |
| [SKILL.md](SKILL.md) | Guide for LLM assistants on writing LiveLLM-compatible responses |

---

## License

[Apache 2.0](LICENSE)
