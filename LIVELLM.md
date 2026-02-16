# LIVELLM.md — AI Integration Reference

> **Audience**: AI agents, LLM tool-use pipelines, and developers integrating LiveLLM.
> **What this is**: The single source of truth for how LiveLLM works, what it can do, and how to use every feature.

---

## What LiveLLM Does

LiveLLM is a framework-agnostic JavaScript library that transforms LLM Markdown responses into interactive Web Component UIs. It works in three ways:

1. **Auto-detection** — The Transformer scans natural Markdown for 7 patterns (tables, questions, charts, etc.) and upgrades them to interactive components. The LLM writes plain Markdown; LiveLLM does the rest.
2. **Explicit syntax** — For precise control, use `` `livellm:component{json}` `` (inline) or fenced blocks (block components).
3. **Streaming** — Token-by-token rendering with skeleton placeholders and a char-level state machine.

**Key properties**: framework-agnostic (Web Components only), tree-shakeable, streaming-first, bidirectional actions (components send user feedback back to your app).

---

## Quick Start

### Vanilla HTML

```html
<script src="https://unpkg.com/livellm/dist/livellm.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/livellm/src/themes/default.css">

<div id="output"></div>

<script>
  // Render static markdown
  LiveLLM.render('## Hello\n\n| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |', '#output');

  // Or stream from an API
  const sr = LiveLLM.createStreamRenderer('#output');
  // ... push tokens, then sr.end()
</script>
```

### npm / ESM

```bash
npm install livellm
```

```js
import LiveLLM from 'livellm';
import 'livellm/themes/default.css';

LiveLLM.init({ theme: 'default' });
LiveLLM.render(markdown, '#output');
```

### React

```tsx
import { useEffect, useRef } from 'react';
import LiveLLM from 'livellm';
import 'livellm/themes/default.css';

function Chat() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    LiveLLM.init();
    LiveLLM.on('action:triggered', (action) => {
      console.log('User action:', action);
    });
  }, []);

  const handleStream = async (url: string, body: object) => {
    const sr = LiveLLM.createStreamRenderer(ref.current!, {
      autoScroll: true,
      showCursor: true,
      onEnd: (fullText) => { /* save to history */ },
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') { sr.end(); return; }
        try {
          const { token } = JSON.parse(data);
          if (token) sr.push(token);
        } catch {}
      }
    }
    sr.end();
  };

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
  LiveLLM.init();
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

  let container;
  onMount(() => {
    LiveLLM.init();
    LiveLLM.render(markdown, container);
  });
</script>

<div bind:this={container}></div>
```

---

## Configuration

```js
LiveLLM.init({
  // Theme: 'default' | 'dark' | 'minimal' | 'custom'
  theme: 'default',

  // Locale for i18n
  locale: 'en',

  // Debug mode — logs all events to console
  debug: false,

  // Which components to load: 'all' | 'core' | ['alert', 'chart', ...]
  components: 'all',

  // Lazy-load components on first use
  lazyLoad: true,

  // Transformer — auto-detects patterns in natural markdown
  transformer: {
    // 'auto': detect + transform | 'passive': detect only | 'off': disabled
    mode: 'auto',
    // Which detectors: 'all' | ['table', 'question', ...]
    detectors: 'all',
    // Minimum confidence to apply a detection (0.0 - 1.0)
    confidenceThreshold: 0.7,
  },

  // Markdown-it options
  markdown: {
    gfm: true,        // GitHub-flavored markdown
    breaks: true,      // Newlines become <br>
    linkify: true,     // Auto-link URLs
    typographer: true, // Smart quotes, dashes
  },

  // Renderer options
  renderer: {
    shadowDom: true,     // Components use Shadow DOM
    sanitize: true,      // Sanitize HTML output
    proseStyles: true,   // Wrap output in .livellm-prose for typography
  },

  // Streaming options
  streaming: {
    enabled: true,
    skeletonDelay: 200,  // ms before showing skeleton placeholder
    showCursor: true,    // Blinking cursor during streaming
    autoScroll: true,    // Auto-scroll to bottom
    cursorChar: '▊',
  },

  // Action handling
  actions: {
    onAction: (action) => {},  // Global action handler
    autoSend: false,           // Auto-send without preview
    showPreview: true,         // Show preview before sending
    labelTemplates: {},        // Custom label templates
  },

  // Security
  security: {
    enableCodeRunner: false,    // Allow code execution in code-runner
    allowedOrigins: ['*'],
    maxJsonSize: 50000,         // Max JSON prop size in bytes
  },

  // Custom CSS variables (override theme)
  themeVars: {},
});
```

---

## The Transformer Pipeline

The Transformer is what makes LiveLLM magic: the LLM writes standard Markdown, and LiveLLM auto-detects patterns and upgrades them to interactive components.

### How It Works

1. **Detection**: Each detector scans the markdown string and returns `DetectionMatch[]` with position, data, and confidence (0.0–1.0).
2. **Overlap Resolution**: When detections overlap, the highest-confidence match wins.
3. **Transformation**: Winning matches are replaced with `livellm:` blocks (in reverse position order to preserve offsets).
4. **Parsing**: The Parser converts `livellm:` blocks into Web Components.

### Modes

| Mode | Behavior |
|------|----------|
| `auto` | Detect patterns + transform to components (default) |
| `passive` | Detect patterns + emit events, but don't transform |
| `off` | Skip transformer entirely |

### Confidence Threshold

Default: `0.7`. Only detections at or above this threshold are applied.

- Lower (e.g., `0.5`): More aggressive — more patterns detected, more false positives.
- Higher (e.g., `0.9`): Conservative — only strong matches.

```js
LiveLLM.init({
  transformer: { mode: 'auto', confidenceThreshold: 0.8 }
});
```

### Custom Detectors

```js
LiveLLM.transformer.register('emoji', {
  detect(markdown) {
    const matches = [];
    const re = /:(\w+):/g;
    let m;
    while ((m = re.exec(markdown))) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        confidence: 0.9,
        data: { emoji: m[1] },
      });
    }
    return matches;
  },
  transform(match) {
    return `\`livellm:badge{"text":"${match.data.emoji}","color":"purple"}\``;
  },
});
```

---

## 7 Built-In Detectors

Each detector automatically converts natural Markdown into an interactive component.

### 1. Table → `table-plus`

**Pattern**: GFM table with header row, separator row (`|---|`), and 2+ data rows.

**LLM writes:**
```markdown
| Framework | Stars | Language   |
|-----------|-------|------------|
| React     | 220k  | JavaScript |
| Vue       | 207k  | JavaScript |
| Svelte    | 78k   | JavaScript |
```

**User sees:** Sortable, searchable interactive table. Tables with 5+ rows get search. Tables with 10+ rows get pagination.

**Confidence:** 0.7 base, +0.1 for 5+ rows, +0.05 for 10+ rows, +0.1 for consistent columns. Max 1.0.

---

### 2. Question → `choice` or `confirm`

**Pattern**: Line ending with `?` followed by 2+ numbered/lettered options, OR question containing yes/no/confirm/proceed keywords.

**LLM writes (multiple choice):**
```markdown
What type of project would you like to create?

1. Web Application
2. REST API
3. Mobile App
```

**User sees:** Clickable choice buttons. Emits `action:triggered` with selected option.

**LLM writes (yes/no):**
```markdown
Do you want to proceed with the deployment?
```

**User sees:** Confirm dialog with Yes/No buttons.

**Confidence:** 0.7 base, +0.15 for yes/no, +0.1 for 3+ options, +0.05 for 5+ options. Max 1.0.

---

### 3. Data → `chart`

**Pattern**: 3+ bullet items with "Label: number" format. Supports `$`, `%`, `K`, `M`, `B` suffixes.

**LLM writes (bar chart):**
```markdown
- Revenue: 45000
- Expenses: 32000
- Profit: 13000
```

**LLM writes (pie chart — percentages):**
```markdown
- Services: 35%
- Products: 28%
- Subscriptions: 22%
- Consulting: 15%
```

**LLM writes (line chart — time series):**
```markdown
- 2021: 1200
- 2022: 1800
- 2023: 2400
- 2024: 3100
```

**Chart type selection:** `line` if 60%+ labels are years/months/dates, `pie` if percentages and 8 or fewer items, else `bar`.

**Confidence:** 0.65 base, +0.1 for 5+ points, +0.1 for percentages, +0.1 for time series. Max 1.0.

---

### 4. List → `accordion`

**Pattern**: 3+ sequential numbered items with average length 15+ chars. Gets boosted when 40%+ items contain step keywords (install, configure, create, run, deploy, etc.).

**LLM writes:**
```markdown
1. Install Node.js 18+ from the official website
2. Create a new project directory and initialize with npm init
3. Install the required dependencies using npm install
4. Configure your environment variables in .env
5. Start the development server with npm run dev
```

**User sees:** Collapsible accordion sections with step titles and descriptions.

**Confidence:** 0.65 base, +0.15 for step keywords, +0.1 for 5+ items, +0.05 for 8+ items. Max 1.0.

---

### 5. Address → `map`

**Pattern**: US-style address (number + street, city, state, zip), international address, or lat/lng coordinates.

**LLM writes:**
```markdown
1600 Amphitheatre Parkway, Mountain View, CA 94043
```

Or:
```markdown
40.7128, -74.0060
```

**User sees:** Interactive embedded map centered on the location.

**Confidence:** 0.85 for text addresses, 0.9 for coordinates. Fixed values.

---

### 6. Code → `code-runner`

**Pattern**: Fenced code block with a recognized language tag, 2+ lines, 20+ characters.

**LLM writes:**
````markdown
```python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print(fibonacci(10))
```
````

**User sees:** Syntax-highlighted code with line numbers, copy button. Runnable languages (JavaScript, Python, HTML, CSS, SQL, Shell) get a Run button.

**Confidence:** 0.6 base, +0.15 for known language, +0.1 for 5+ lines, +0.05 for runnable. Max 1.0.

---

### 7. Link → `link-preview`

**Pattern**: Standalone URL on its own line (not inside `[text](url)` markdown link syntax).

**LLM writes:**
```markdown
https://github.com/facebook/react
```

**User sees:** Rich link preview card with title, description, favicon, and domain.

**Confidence:** 0.85 for whitelisted domains (GitHub, YouTube, StackOverflow, Wikipedia, npm, etc.), 0.7 for other domains.

---

## All 30 Components

### Block Components (15)

These render as full-width block elements. Use with fenced code blocks for explicit syntax.

#### `table-plus`
Sortable, searchable, paginated data table.
```
```livellm:table-plus
{"columns":[{"key":"name","label":"Name","sortable":true}],"data":[{"name":"Alice"}],"searchable":true,"paginate":false,"pageSize":10,"selectable":false}
```
```
- `columns`: array of `{key, label, sortable?}` — Required (or use `headers`)
- `data`: array of row objects — Required (or use `rows`, `items`, `records`)
- `searchable`: boolean (default: true)
- `sortable`: boolean (default: true)
- `pageSize`: number (default: 0 = no pagination)
- `selectable`: boolean (default: false)

#### `tabs`
Tabbed content panels.
```
```livellm:tabs
{"tabs":[{"label":"Tab 1","content":"Content here"},{"label":"Tab 2","content":"More content"}],"defaultTab":0}
```
```
- `tabs`: array of `{label, content}` — Required (aliases: `items`, `sections`, `panels`)
- `defaultTab`: number (default: 0)

#### `chart`
Data visualization: bar, line, pie, doughnut, area, radar, scatter.
```
```livellm:chart
{"type":"bar","title":"Sales","labels":["Q1","Q2","Q3"],"datasets":[{"label":"Revenue","data":[100,200,300]}]}
```
```
- `type`: `'bar'|'line'|'pie'|'doughnut'|'area'|'radar'|'scatter'` (default: `'bar'`)
- `title`: string
- `labels`: array of strings (aliases: `categories`, `xAxis`)
- `datasets`: array of `{label, data, color?}` (aliases: `series`, `data`)
- `legend`: boolean (default: true)
- `responsive`: boolean (default: true)

#### `accordion`
Collapsible sections.
```
```livellm:accordion
{"sections":[{"title":"Section 1","content":"Details..."},{"title":"Section 2","content":"More details..."}],"exclusive":true,"defaultOpen":0}
```
```
- `sections`: array of `{title, content}` — Required (alias: `items`)
- `exclusive`: boolean (default: true) — only one section open at a time
- `defaultOpen`: number (default: 0)

#### `steps`
Step-by-step progress indicator.
```
```livellm:steps
{"steps":[{"label":"Setup","description":"Initialize the project"},{"label":"Build","description":"Compile the code"}],"current":0}
```
```
- `steps`: array of `{label, description}` — Required (aliases: `items`, `stages`)
- `current`: number (default: -1)
- `title`: string

**Note:** Steps use `label` property (not `title`) for step text.

#### `timeline`
Vertical timeline of events.
```
```livellm:timeline
{"events":[{"date":"2024-01","title":"Launch","description":"Product launched"},{"date":"2024-06","title":"Growth","description":"10k users"}]}
```
```
- `events`: array of `{date, title, description}` — Required (aliases: `items`, `entries`)
- `title`: string

#### `map`
Interactive embedded map.
```
```livellm:map
{"lat":40.7128,"lng":-74.0060,"zoom":15,"title":"New York City"}
```
```
- `lat`: number — Required
- `lng`: number — Required
- `zoom`: number (default: 13, range: 1–20)
- `title`: string
- `address`: string (alternative to lat/lng)
- `markers`: array of `{lat, lng, title?}`

#### `form`
Dynamic form with input fields.
```
```livellm:form
{"title":"Contact","fields":[{"name":"email","type":"email","label":"Email","required":true}],"submitLabel":"Send"}
```
```
- `fields`: array of field objects — Required (aliases: `inputs`, `items`)
- `title`: string
- `submitLabel`: string (default: `'Submit'`)
- `prefill`: object of default values (aliases: `defaults`, `values`)

#### `video`
Embedded video player (YouTube, Vimeo, direct URL).
```
```livellm:video
{"url":"https://youtube.com/watch?v=dQw4w9WgXcQ","caption":"Demo video"}
```
```
- `url`: string — Required
- `caption`: string
- `autoplay`: boolean (default: false)

#### `pricing`
Pricing tier comparison cards.
```
```livellm:pricing
{"tiers":[{"name":"Free","price":"$0/mo","features":["5 projects","1GB storage"]},{"name":"Pro","price":"$19/mo","features":["Unlimited projects","100GB storage"],"highlighted":true}]}
```
```
- `tiers`: array of `{name, price, features[], highlighted?, cta?}` — Required (aliases: `plans`, `items`, `pricing`)

**Note:** Each tier must include a `features` array.

#### `carousel`
Swipeable content slides.
```
```livellm:carousel
{"slides":[{"title":"Slide 1","content":"First slide"},{"title":"Slide 2","content":"Second slide"}],"loop":false}
```
```
- `slides`: array of `{title?, content, image?}` — Required (aliases: `items`, `cards`, `pages`)
- `loop`: boolean (default: false)

#### `file-preview`
File preview card with metadata.
```
```livellm:file-preview
{"filename":"report.pdf","size":"2.4 MB","content":"Quarterly financial report"}
```
```
- `filename`: string — Required
- `url`: string
- `size`: string
- `content`: string
- `language`: string

#### `calendar`
Interactive calendar widget.
```
```livellm:calendar
{"date":"2024-03-15","events":[{"date":"2024-03-15","title":"Meeting","description":"Team sync"}]}
```
```
- `date`: string (ISO date, defaults to today)
- `events`: array of `{date, title, description?}`

#### `link-preview`
Rich URL preview card.
```
```livellm:link-preview
{"url":"https://github.com/facebook/react","title":"React","description":"A JavaScript library for building user interfaces","domain":"github.com"}
```
```
- `url`: string — Required
- `title`: string
- `description`: string
- `image`: string
- `domain`: string

#### `code-runner`
Code block with syntax highlighting, copy, and optional run.
```
```livellm:code-runner
{"language":"javascript","code":"console.log('Hello');","showLineNumbers":true,"copyable":true,"runnable":true}
```
```
- `code`: string — Required
- `language`: string
- `showLineNumbers`: boolean (default: true)
- `copyable`: boolean (default: true)
- `runnable`: boolean (default: false)

**Security:** `runnable` requires `security.enableCodeRunner: true` in config.

---

### Inline Components (7)

These render inline within text. Use single backtick syntax: `` `livellm:name{json}` ``

#### `alert`
Colored inline alert/notification.
```
`livellm:alert{"type":"info","text":"This is an informational message"}`
```
- `type`: `'info'|'success'|'warning'|'error'` (default: `'info'`)
- `text`: string — Required

#### `badge`
Colored label/tag badge.
```
`livellm:badge{"text":"v2.0","color":"blue"}`
```
- `text`: string — Required
- `color`: `'green'|'red'|'blue'|'yellow'|'gray'|'purple'` (default: `'blue'`)
- `variant`: `'solid'|'outline'` (default: `'solid'`)

#### `progress`
Progress bar.
```
`livellm:progress{"value":75,"max":100,"label":"75% complete"}`
```
- `value`: number — Required (min: 0)
- `max`: number (default: 100)
- `label`: string
- `color`: string

#### `tooltip`
Hover tooltip on text.
```
`livellm:tooltip{"text":"Hover me","tip":"This is the tooltip content"}`
```
- `text`: string — Required (the visible text)
- `tip`: string — Required (the tooltip content)

#### `rating`
Star rating display (read-only).
```
`livellm:rating{"value":4.5,"max":5}`
```
- `value`: number — Required
- `max`: number (default: 5)
- `showValue`: boolean (default: true)

#### `counter`
Animated number counter.
```
`livellm:counter{"value":1250,"label":"Users","prefix":"$","suffix":"K"}`
```
- `value`: number — Required
- `label`: string
- `prefix`: string
- `suffix`: string
- `format`: string (default: `'number'`)

#### `tag`
Tag/chip group.
```
`livellm:tag{"tags":["React","Vue","Svelte"],"color":"blue"}`
```
- `tags`: array of strings — Required
- `color`: string (default: `'blue'`)
- `variant`: string (default: `'solid'`)
- `clickable`: boolean (default: false)

---

### Action Components (8)

These collect user input and emit `action:triggered` events. Use fenced code blocks.

#### `choice`
Single-select option buttons.
```
```livellm:choice
{"question":"What framework do you prefer?","options":["React","Vue","Svelte","Angular"]}
```
```
- `question`: string
- `options`: array of strings or `{label, value}` objects (aliases: `choices`, `items`)

**Action emitted:** `{component: 'choice', action: 'select', value: 'React', label: 'React'}`

#### `confirm`
Yes/No confirmation dialog.
```
```livellm:confirm
{"text":"Deploy to production?","confirmLabel":"Yes, deploy","cancelLabel":"Cancel"}
```
```
- `text`: string (default: `'Are you sure?'`)
- `confirmLabel`: string (default: `'Yes'`)
- `cancelLabel`: string (default: `'No'`)

**Action emitted:** `{component: 'confirm', action: 'confirm'|'cancel', value: true|false}`

#### `multi-choice`
Multiple-select checkboxes.
```
```livellm:multi-choice
{"question":"Select your skills:","options":["JavaScript","Python","Rust","Go"],"min":1,"max":3}
```
```
- `question`: string
- `options`: array
- `min`: number (default: 1)
- `max`: number (default: 10)

#### `rating-input`
Interactive star rating input.
```
```livellm:rating-input
{"label":"Rate our service","max":5,"lowLabel":"Poor","highLabel":"Excellent"}
```
```
- `label`: string (default: `'Rate this response'`)
- `max`: number (default: 5, range: 1–10)
- `lowLabel`: string
- `highLabel`: string

#### `date-picker`
Date (and optional time) picker.
```
```livellm:date-picker
{"label":"Select delivery date","min":"2024-01-01","max":"2024-12-31","includeTime":false}
```
```
- `label`: string (default: `'Select a date'`)
- `min`: string (ISO date)
- `max`: string (ISO date)
- `includeTime`: boolean (default: false)

#### `text-input`
Free-text input field.
```
```livellm:text-input
{"label":"Describe your issue","placeholder":"Type here...","multiline":true,"maxLength":500}
```
```
- `label`: string (default: `'Enter your response'`)
- `placeholder`: string
- `hint`: string
- `multiline`: boolean (default: false)
- `maxLength`: number (default: 0 = unlimited)

#### `slider`
Numeric range slider.
```
```livellm:slider
{"label":"Budget","min":0,"max":10000,"step":100,"defaultValue":5000,"suffix":"$"}
```
```
- `label`: string (default: `'Select a value'`)
- `min`: number (default: 0)
- `max`: number (default: 100)
- `step`: number (default: 1)
- `defaultValue`: number
- `suffix`: string
- `showRange`: boolean (default: true)

#### `file-upload`
File upload input.
```
```livellm:file-upload
{"label":"Upload your resume","accept":".pdf,.docx","maxSizeMB":5,"multiple":false}
```
```
- `label`: string (default: `'Upload a file'`)
- `accept`: string (file type filter)
- `maxSizeMB`: number (default: 10)
- `multiple`: boolean (default: false)

---

## Streaming API

### Creating a Stream Renderer

```js
const sr = LiveLLM.createStreamRenderer('#output', {
  autoScroll: true,
  showCursor: true,
  cursorChar: '▊',
  skeletonDelay: 200,
  transformOnComplete: true,   // Run Transformer after stream ends
  transformDuringStream: false, // Don't transform mid-stream

  onStart: () => {},
  onToken: (token) => {},
  onComponentStart: (type) => {},
  onComponentComplete: (type, props) => {},
  onEnd: (fullText) => {},
  onError: (error) => {},
});
```

### Push / End / Abort

```js
// Push tokens as they arrive
sr.push('Hello ');
sr.push('World\n\n');
sr.push('| A | B |\n|---|---|\n| 1 | 2 |');

// Signal end of stream
sr.end();

// Or abort mid-stream
sr.abort();
```

### State Machine

```
IDLE → RENDERING → BUFFERING → RENDERING → INTERACTIVE
                                    ↓
                                  ERROR
```

- `IDLE`: Created, waiting for first token
- `RENDERING`: Processing text tokens
- `BUFFERING`: Inside a `livellm:` block, showing skeleton
- `INTERACTIVE`: Stream ended, all components rendered

```js
sr.getState(); // 'IDLE' | 'RENDERING' | 'BUFFERING' | 'INTERACTIVE' | ...
sr.getFullText(); // Accumulated raw text
```

### SSE Adapter Pattern

```js
const response = await fetch('/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') { sr.end(); return; }
    try {
      const { token } = JSON.parse(data);
      if (token) sr.push(token);
    } catch {}
  }
}
sr.end();
```

### Skeleton Lifecycle

When streaming encounters a `livellm:` block:

1. Opening fence detected (` ``` livellm:chart`) → state moves to `BUFFERING`
2. After `skeletonDelay` ms, a skeleton placeholder appears
3. JSON body streams in, skeleton remains visible
4. Closing fence detected (` ``` `) → component renders, skeleton removed
5. If stream ends mid-component → fallback rendered (raw code block)

---

## Bidirectional Actions

Action components collect user input and emit events back to your application.

### Listening for Actions

```js
LiveLLM.on('action:triggered', (action) => {
  console.log(action);
  // {
  //   type: 'livellm:action',
  //   component: 'choice',
  //   action: 'select',
  //   value: 'React',
  //   label: 'React',
  //   metadata: {
  //     componentId: 'livellm-choice-1',
  //     timestamp: 1708012345678,
  //     questionContext: 'What framework do you prefer?'
  //   }
  // }
});
```

### LiveLLMAction Shape

```ts
interface LiveLLMAction {
  type: 'livellm:action';
  component: string;      // Component name: 'choice', 'confirm', 'slider', etc.
  action: string;          // Action type: 'select', 'confirm', 'cancel', 'submit', 'change'
  value: any;              // The user's selection/input
  label: string;           // Human-readable label
  metadata: {
    componentId: string;
    timestamp: number;
    questionContext?: string;
  };
}
```

### Action Lifecycle

1. User interacts with component (clicks button, selects option, submits form)
2. Component emits `livellm:action` CustomEvent (bubbles through Shadow DOM)
3. Renderer catches event, normalizes to `LiveLLMAction`, emits `action:triggered`
4. Your `onAction` callback receives the action
5. You can send the action value back to the LLM as context

### Auto-Send Mode

```js
LiveLLM.init({
  actions: {
    autoSend: true,  // Skip preview, emit immediately
    onAction: (action) => {
      // Send back to LLM
      sendMessage(`User selected: ${action.label}`);
    },
  },
});
```

---

## Events Catalog

Subscribe with `LiveLLM.on(event, handler)`.

| Event | Payload | When |
|-------|---------|------|
| `renderer:start` | — | Render begins |
| `renderer:complete` | — | Render finishes |
| `action:triggered` | `LiveLLMAction` | User interacts with action component |
| `stream:start` | — | Stream renderer created |
| `stream:token` | `string` | Token pushed |
| `stream:component:start` | `string` (type) | Block component fence detected |
| `stream:component:complete` | `string, object` (type, props) | Block component fully received |
| `stream:end` | `string` (fullText) | Stream ended |
| `stream:error` | `Error` | Stream error |
| `stream:abort` | — | Stream aborted |
| `observer:started` | `HTMLElement` | Observer started watching |
| `observer:stopped` | — | Observer disconnected |
| `observer:processed` | `number` | Observer processed N components |
| `observer:component-rendered` | `{name, props}` | Observer rendered a component |

---

## Observer Mode

For dynamic content (e.g., chat apps where new messages arrive via DOM manipulation), the Observer watches for `livellm:` code blocks and auto-renders them.

```js
LiveLLM.observe({
  target: '#chat-container',  // CSS selector or element
  childList: true,
  characterData: true,
  subtree: true,
  debounce: 100,  // ms debounce
});

// Later
LiveLLM.disconnect();
```

The Observer finds `<pre><code>livellm:component\n{json}</code></pre>` elements and replaces them with rendered Web Components. It marks processed elements with `data-livellm-processed` to avoid double-rendering.

---

## Theming

### Built-In Themes

```js
import 'livellm/themes/default.css'; // Light theme
import 'livellm/themes/dark.css';    // Dark theme
import 'livellm/themes/minimal.css'; // Minimal/stripped theme
```

### CSS Custom Properties

Override any theme variable:

```css
:root {
  --livellm-font-family: 'Inter', sans-serif;
  --livellm-font-size: 15px;
  --livellm-line-height: 1.7;
  --livellm-color-text: #1a1a2e;
  --livellm-color-bg: #ffffff;
  --livellm-color-primary: #6c5ce7;
  --livellm-color-border: #e0e0e0;
  --livellm-radius: 8px;
  --livellm-spacing: 1rem;
}
```

Or via config:

```js
LiveLLM.init({
  themeVars: {
    '--livellm-color-primary': '#ff6b6b',
  },
});
```

---

## Custom Components

### Registering a Component

```js
class MyWidget extends HTMLElement {
  connectedCallback() {
    const props = JSON.parse(this.getAttribute('data-props') || '{}');
    this.innerHTML = `<div>${props.message}</div>`;
  }
}

LiveLLM.register('widget', MyWidget, {
  schema: {
    message: { type: 'string', required: true },
    count: { type: 'number', default: 0 },
  },
  category: 'block',
});
```

### Using the Base Class

```js
import { LiveLLMComponent } from 'livellm';

class MyAction extends LiveLLMComponent {
  render(props) {
    const btn = document.createElement('button');
    btn.textContent = props.label;
    btn.onclick = () => {
      this.emitAction('click', { label: props.label });
    };
    this.shadowRoot.appendChild(btn);
  }
}
```

`LiveLLMComponent` provides:
- Shadow DOM setup
- `data-props` auto-parsing
- `this.emitAction(action, data)` — emits `livellm:action` CustomEvent

---

## Explicit `livellm:` Syntax

For precise control when auto-detection isn't desired:

### Block Components (fenced code blocks)

````markdown
```livellm:chart
{"type":"pie","labels":["A","B","C"],"datasets":[{"label":"Data","data":[30,50,20]}]}
```
````

### Inline Components (single backticks)

```markdown
Status: `livellm:badge{"text":"Online","color":"green"}` — All systems operational.
```

### Rules

- Block: ` ```livellm:name ` on its own line, JSON body, closing ` ``` `
- Inline: `` `livellm:name{json}` `` within text
- JSON must be valid (double quotes, no trailing commas)
- Component must be registered in the registry
- Props are validated against the component's schema; invalid props get defaults

---

## Server Protocol

LiveLLM ships a typed protocol (`livellm/protocol`) that standardizes communication between your server and client.

### SSE Stream Events

The server sends `data: {json}\n\n` lines. Each JSON object has a `type` discriminator:

| Type | Shape | When |
|------|-------|------|
| `token` | `{type:"token", token:"Hello"}` | Each text chunk from the LLM |
| `metadata` | `{type:"metadata", model?, provider?, usage?, latency_ms?}` | Start (model info) and/or end (usage stats) |
| `error` | `{type:"error", code, message, recoverable}` | Error mid-stream |
| `done` | `{type:"done", fullText?}` | Stream ended |

Error codes: `'provider_error'`, `'rate_limit'`, `'context_overflow'`, `'timeout'`, `'unknown'`.

### Static Response

```ts
interface LiveLLMResponse {
  content: string;      // Markdown text
  model?: string;       // e.g., 'llama-3.3-70b-versatile'
  provider?: string;    // e.g., 'groq'
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}
```

### Action Feedback (client → server)

When a user interacts with an action component, send it back:

```ts
interface LiveLLMActionPayload {
  component: string;  // 'choice' | 'confirm' | 'slider' | etc.
  action: string;     // 'select' | 'confirm' | 'cancel' | 'submit'
  value: any;
  label: string;
  context?: string;   // Original question
}
```

### Server Helper

```js
import { createSSEWriter, formatActionAsMessage } from 'livellm/protocol';

app.post('/api/chat/stream', (req, res) => {
  const sse = createSSEWriter(res);
  sse.writeHeaders();
  sse.metadata({ model: 'llama-70b', provider: 'groq' });

  // For each LLM token:
  sse.token('Hello');
  sse.token(' world');

  // On completion:
  sse.done('Hello world');
});

app.post('/api/chat/action', (req, res) => {
  const { action, history } = req.body;
  const userMessage = formatActionAsMessage(action);
  // userMessage → "User selected: React"
  // Inject into history and stream response...
});
```

### Client Helper

```ts
import LiveLLM from 'livellm';
import { connectLiveLLMStream } from 'livellm/protocol';

const sr = LiveLLM.createStreamRenderer('#output');
const response = await fetch('/api/chat/stream', { method: 'POST', body: ... });

await connectLiveLLMStream(response, sr, {
  onMetadata: (meta) => console.log('Model:', meta.model, 'Tokens:', meta.usage?.total_tokens),
  onError: (err) => console.error(err.code, err.message),
  onDone: (event) => console.log('Done, full text:', event.fullText),
});
```

### Backwards Compatibility

`connectLiveLLMStream` also handles legacy formats:
- Bare `{token: "..."}` objects (pre-protocol)
- `[DONE]` string signal

---

## API Reference (Singleton)

```ts
// Rendering
LiveLLM.render(markdown: string, target: string | HTMLElement): HTMLElement | null
LiveLLM.renderToString(markdown: string): string

// Streaming
LiveLLM.createStreamRenderer(target: string | HTMLElement, options?: StreamRendererOptions): StreamRenderer

// Transformer
LiveLLM.transform(markdown: string): string
LiveLLM.transformer.register(name: string, detector: DetectorDefinition): void

// Registry
LiveLLM.register(name: string, component: CustomElementConstructor, options: RegisterOptions): void
LiveLLM.registry.has(name: string): boolean
LiveLLM.registry.get(name: string): ComponentRegistration | undefined
LiveLLM.registry.list(): string[]

// Events
LiveLLM.on(event: string, handler: Function): void
LiveLLM.off(event: string, handler: Function): void
LiveLLM.once(event: string, handler: Function): void

// Observer
LiveLLM.observe(options: ObserverOptions): void
LiveLLM.disconnect(): void

// Lifecycle
LiveLLM.init(config?: Partial<LiveLLMConfig>): void
LiveLLM.destroy(): void
LiveLLM.reset(): void

// Properties
LiveLLM.version: string  // '0.1.0'
```
