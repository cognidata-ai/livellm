# LiveLLM — Component API Reference

## How It Works

LiveLLM uses a special markdown fence syntax to embed interactive components inside LLM responses.

### Block Components (fence syntax)

````markdown
```livellm:component-name
{
  "prop1": "value1",
  "prop2": "value2"
}
```
````

### Inline Components (code syntax)

```markdown
Some text with `livellm:component-name{"prop":"value"}` inline.
```

---

## Quick Start

```html
<script src="livellm.min.js"></script>
<div id="output"></div>
<script>
  // Static render
  LiveLLM.render(markdownString, '#output');

  // Streaming render
  const stream = LiveLLM.stream('#output');
  stream.push('Here is a chart:\n');
  stream.push('```livellm:chart\n');
  stream.push('{"labels":["A","B"],"datasets":[{"label":"Sales","data":[10,20]}]}\n');
  stream.push('```\n');
  stream.end();
</script>
```

---

## Block Components (15)

### `table-plus` — Interactive Data Table

Sortable, searchable, paginated table.

```json
{
  "columns": [
    { "key": "product", "label": "Product", "sortable": true },
    { "key": "price", "label": "Price", "type": "number", "sortable": true },
    { "key": "stock", "label": "Stock", "type": "number" }
  ],
  "rows": [
    { "product": "Laptop", "price": 999, "stock": 45 },
    { "product": "Mouse", "price": 29, "stock": 200 }
  ],
  "searchable": true,
  "sortable": true,
  "pageSize": 10
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` / `headers` | array | `[]` | Column definitions. Each: `{ key, label, sortable?, type? }` |
| `rows` / `data` / `items` / `records` | array | `[]` | Row data objects |
| `searchable` | boolean | `true` | Show search input |
| `sortable` | boolean | `true` | Enable column sorting |
| `pageSize` | number | `0` | Rows per page (0 = no pagination) |
| `selectable` | boolean | `false` | Enable row selection |

**Column aliases:** `key`/`field`/`id`/`name`, `label`/`title`/`header`
**Auto-columns:** If no columns are provided, they are auto-generated from the first row's keys.

---

### `chart` — SVG Charts

Bar, line, pie, and doughnut charts rendered as pure SVG.

```json
{
  "type": "bar",
  "title": "Monthly Sales",
  "labels": ["Jan", "Feb", "Mar", "Apr"],
  "datasets": [
    { "label": "Revenue", "data": [12000, 19000, 15000, 22000], "color": "#6c5ce7" },
    { "label": "Costs", "data": [8000, 11000, 9000, 13000], "color": "#ff6b6b" }
  ],
  "legend": true
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | enum | `"bar"` | `bar`, `line`, `pie`, `doughnut` |
| `title` | string | `""` | Chart title |
| `labels` / `categories` / `xAxis` | array | `[]` | X-axis labels |
| `datasets` / `series` / `data` | array | `[]` | Data series |
| `legend` | boolean | `true` | Show legend |

**Dataset format:**
```json
{ "label": "Series Name", "data": [10, 20, 30], "color": "#6c5ce7" }
```
Dataset aliases: `label`/`name`/`title`, `data`/`values`, `color`/`backgroundColor`

---

### `tabs` — Tabbed Content

```json
{
  "tabs": [
    { "label": "Overview", "content": "General information here..." },
    { "label": "Details", "content": "Detailed breakdown..." },
    { "label": "Code", "content": "const x = 42;" }
  ],
  "defaultTab": 0
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` / `items` / `sections` / `panels` | array | `[]` | Tab definitions |
| `defaultTab` | number | `0` | Initially active tab index |

**Tab item aliases:** `label`/`title`/`name`/`header`, `content`/`body`/`text`/`description`

---

### `accordion` — Collapsible Sections

```json
{
  "title": "FAQ",
  "sections": [
    { "title": "What is LiveLLM?", "content": "A library for interactive LLM UIs." },
    { "title": "How to install?", "content": "npm install livellm" }
  ],
  "defaultOpen": 0
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` / `sections` | array | `[]` | Accordion items |
| `title` | string | `""` | Accordion heading |
| `exclusive` | boolean | `true` | Only one item open at a time |
| `defaultOpen` | number | `0` | Initially open item index |

**Item aliases:** `title`/`label`/`name`, `content`/`body`/`description`/`text`

---

### `steps` — Step Progress Indicator

```json
{
  "title": "Setup Process",
  "steps": [
    { "label": "Install", "description": "npm install livellm" },
    { "label": "Configure", "description": "Add to your project" },
    { "label": "Deploy", "description": "Ship it!" }
  ],
  "current": 1
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `steps` / `items` / `stages` | array | `[]` | Step definitions |
| `title` | string | `""` | Section title |
| `current` / `currentStep` | number | `-1` | Active step index (-1 = none) |

**Step aliases:** `label`/`title`/`name`/`text`, `description`/`content`/`body`/`detail`

---

### `timeline` — Event Timeline

```json
{
  "title": "Project History",
  "events": [
    { "date": "2026-01-15", "title": "Project started", "description": "Initial commit" },
    { "date": "2026-02-01", "title": "Beta release", "description": "First public beta" },
    { "date": "2026-02-14", "title": "v1.0 Launch", "color": "#00b894" }
  ]
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `events` / `items` / `entries` | array | `[]` | Timeline events |
| `title` | string | `""` | Section title |

**Event aliases:** `date`/`time`/`when`/`timestamp`, `title`/`label`/`name`/`event`, `description`/`content`/`body`/`detail`

---

### `form` — Dynamic Form

```json
{
  "title": "Contact Us",
  "fields": [
    { "name": "name", "type": "text", "label": "Your Name", "required": true },
    { "name": "email", "type": "email", "label": "Email", "required": true },
    { "name": "subject", "type": "select", "label": "Subject", "options": ["Support", "Sales", "Other"] },
    { "name": "message", "type": "textarea", "label": "Message", "rows": 4, "placeholder": "Type here..." },
    { "name": "newsletter", "type": "checkbox", "label": "Subscribe to newsletter" }
  ],
  "submitLabel": "Send Message"
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fields` / `inputs` / `items` | array | `[]` | Field definitions |
| `title` | string | `""` | Form header |
| `submitLabel` / `buttonText` / `submit` | string | `"Submit"` | Submit button text |
| `prefill` / `defaults` / `values` | object | `{}` | Pre-fill values `{ fieldName: value }` |

**Field types:** `text`, `email`, `number`, `password`, `textarea`, `select`, `checkbox`, `radio`

---

### `map` — Embedded Map

```json
{
  "lat": 40.7128,
  "lng": -74.006,
  "zoom": 13,
  "title": "New York City",
  "address": "Manhattan, NY"
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `lat` | number | **required** | Latitude |
| `lng` | number | **required** | Longitude |
| `zoom` | number | `13` | Zoom level (1-20) |
| `title` | string | `""` | Location name |
| `address` | string | `""` | Address text |
| `height` | string | `"300px"` | Map height |

---

### `pricing` — Pricing Cards

```json
{
  "tiers": [
    {
      "name": "Free",
      "price": 0,
      "period": "/month",
      "features": ["5 projects", "Basic support", "1GB storage"],
      "cta": "Get Started"
    },
    {
      "name": "Pro",
      "price": 29,
      "period": "/month",
      "features": ["Unlimited projects", "Priority support", "100GB storage", "API access"],
      "highlighted": true,
      "badge": "Popular",
      "cta": "Upgrade"
    }
  ]
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tiers` / `plans` / `items` / `pricing` | array | `[]` | Pricing tier cards |

**Tier aliases:** `name`/`title`/`label`/`plan`, `price`/`cost`/`amount`, `features`/`items`/`perks`/`benefits`, `highlighted`/`recommended`/`popular`, `badge`/`tag`, `cta`/`button`/`action`, `period`/`billing`/`interval`

---

### `carousel` — Slide Carousel

```json
{
  "slides": [
    { "title": "Feature 1", "content": "Advanced analytics dashboard", "image": "https://..." },
    { "title": "Feature 2", "content": "Real-time collaboration tools" },
    { "title": "Feature 3", "content": "Enterprise security" }
  ],
  "loop": true
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `slides` / `items` / `cards` / `pages` | array | `[]` | Slide definitions |
| `loop` | boolean | `false` | Loop back to start |

**Slide aliases:** `title`/`label`/`name`, `content`/`body`/`text`/`description`, `image`/`img`/`src`

---

### `video` — Video Embed

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "caption": "Demo video"
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `url` | string | **required** | YouTube or Vimeo URL |
| `caption` | string | `""` | Caption text |
| `autoplay` | boolean | `false` | Auto-play on load |

---

### `calendar` — Monthly Calendar

```json
{
  "date": "2026-02-14",
  "events": [
    { "date": "2026-02-14", "title": "Valentine's Day", "color": "#ff6b6b" },
    { "date": "2026-02-20", "title": "Meeting" }
  ]
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `date` | string | today | Initial date (`YYYY-MM-DD`) |
| `events` | array | `[]` | Calendar events `{ date, title, color? }` |

---

### `file-preview` — File Preview Card

```json
{
  "filename": "report.pdf",
  "size": "2.4 MB",
  "url": "https://example.com/report.pdf",
  "content": "First 500 characters of the file...",
  "language": "javascript"
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `filename` | string | **required** | File name |
| `url` | string | `""` | Download URL |
| `size` | string | `""` | File size display |
| `content` | string | `""` | File content preview |
| `language` | string | `""` | Syntax highlight language |

---

### `link-preview` — Link Preview Card

```json
{
  "url": "https://github.com/livellm",
  "title": "LiveLLM on GitHub",
  "description": "Interactive components for LLM responses",
  "image": "https://opengraph.githubassets.com/...",
  "domain": "github.com"
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `url` | string | **required** | Link URL |
| `title` | string | `""` | Preview title |
| `description` | string | `""` | Preview description |
| `image` | string | `""` | Preview image URL |
| `domain` | string | `""` | Display domain |

---

### `code-runner` — Code Block with Copy/Run

```json
{
  "code": "function hello() {\n  console.log('Hello!');\n}\nhello();",
  "language": "javascript",
  "showLineNumbers": true,
  "copyable": true,
  "runnable": false
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `code` | string | **required** | Source code |
| `language` | string | `""` | Language for display |
| `showLineNumbers` | boolean | `true` | Show line numbers |
| `copyable` | boolean | `true` | Show copy button |
| `runnable` | boolean | `false` | Show run button (JS only) |

---

## Inline Components (7)

### `alert` — Alert Message

```markdown
`livellm:alert{"type":"success","text":"Data saved successfully!"}`
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | enum | `"info"` | `info`, `success`, `warning`, `error` |
| `text` | string | **required** | Alert message |

---

### `badge` — Status Badge

```markdown
`livellm:badge{"text":"Active","color":"green"}`
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | string | **required** | Badge text |
| `color` | enum | `"blue"` | `green`, `red`, `blue`, `yellow`, `gray`, `purple` |
| `variant` | enum | `"solid"` | `solid`, `outline` |

---

### `progress` — Progress Bar

```markdown
`livellm:progress{"value":72,"label":"72% complete"}`
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | number | **required** | Current value |
| `max` | number | `100` | Maximum value |
| `label` | string | `""` | Display label |
| `color` | string | `""` | Custom bar color |

---

### `tooltip` — Hover Tooltip

```markdown
`livellm:tooltip{"text":"API Key","tip":"A unique identifier for authentication"}`
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | string | **required** | Visible text |
| `tip` | string | **required** | Tooltip content |

---

### `rating` — Star Rating Display

```markdown
`livellm:rating{"value":4.5,"max":5}`
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | number | **required** | Rating value |
| `max` | number | `5` | Maximum stars |
| `showValue` | boolean | `true` | Show numeric value |

---

### `counter` — Animated Counter

```markdown
`livellm:counter{"value":15246,"prefix":"$","suffix":" revenue","format":"number"}`
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | number | **required** | Counter value |
| `label` | string | `""` | Label text |
| `prefix` | string | `""` | Before the number |
| `suffix` | string | `""` | After the number |
| `format` | string | `"number"` | `number`, `currency`, `percent` |

---

### `tag` — Tag Pills

```markdown
`livellm:tag{"tags":["JavaScript","TypeScript","React"],"color":"purple"}`
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tags` | array | **required** | Array of tag strings |
| `color` | string | `"blue"` | Tag color |
| `variant` | string | `"solid"` | `solid` or `outline` |
| `clickable` | boolean | `false` | Emit action on click |

---

## Action Components (8)

Action components enable user interaction. They emit `livellm:action` events.

### `choice` — Single Choice Buttons

```json
{
  "question": "How would you like to proceed?",
  "options": [
    { "label": "Continue", "value": "continue", "description": "Proceed to next step" },
    { "label": "Start Over", "value": "restart" },
    { "label": "Cancel", "value": "cancel" }
  ]
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `question` | string | `""` | Question text |
| `options` / `choices` / `items` | array | `[]` | Choice options |

Options can be strings (`"Option A"`) or objects (`{ label, value, description? }`).

---

### `multi-choice` — Multiple Choice Checkboxes

```json
{
  "question": "Select the features you need:",
  "options": ["Authentication", "Database", "File Storage", "Email", "Payments"],
  "min": 1,
  "max": 3
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `question` | string | `""` | Question text |
| `options` / `choices` / `items` | array | `[]` | Choice options |
| `min` | number | `1` | Minimum selections |
| `max` | number | `10` | Maximum selections |

---

### `confirm` — Yes/No Confirmation

```json
{
  "text": "Are you sure you want to delete this item?",
  "confirmLabel": "Delete",
  "cancelLabel": "Keep"
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | string | `"Are you sure?"` | Question text |
| `confirmLabel` | string | `"Yes"` | Confirm button text |
| `cancelLabel` | string | `"No"` | Cancel button text |

---

### `rating-input` — Star Rating Input

```json
{
  "label": "How was your experience?",
  "max": 5,
  "lowLabel": "Poor",
  "highLabel": "Excellent"
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | string | `"Rate this response"` | Label text |
| `max` | number | `5` | Max stars (1-10) |
| `lowLabel` | string | `""` | Label for low end |
| `highLabel` | string | `""` | Label for high end |

---

### `text-input` — Text Input Field

```json
{
  "label": "Describe your issue",
  "placeholder": "Type here...",
  "hint": "Be as specific as possible",
  "multiline": true,
  "maxLength": 500
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | string | `"Enter your response"` | Label text |
| `placeholder` | string | `""` | Placeholder text |
| `hint` | string | `""` | Helper text |
| `multiline` | boolean | `false` | Use textarea |
| `maxLength` | number | `0` | Max characters (0 = unlimited) |

---

### `date-picker` — Date Picker

```json
{
  "label": "Select delivery date",
  "min": "2026-02-15",
  "max": "2026-12-31",
  "includeTime": false
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | string | `"Select a date"` | Label text |
| `min` | string | `""` | Minimum date (`YYYY-MM-DD`) |
| `max` | string | `""` | Maximum date |
| `includeTime` | boolean | `false` | Include time picker |

---

### `slider` — Range Slider

```json
{
  "label": "Select your budget",
  "min": 0,
  "max": 1000,
  "step": 50,
  "defaultValue": 500,
  "suffix": " USD"
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | string | `"Select a value"` | Label text |
| `min` | number | `0` | Minimum value |
| `max` | number | `100` | Maximum value |
| `step` | number | `1` | Step increment |
| `defaultValue` | number | midpoint | Initial value |
| `suffix` | string | `""` | Value suffix |
| `showRange` | boolean | `true` | Show min/max labels |

---

### `file-upload` — File Upload

```json
{
  "label": "Upload your document",
  "accept": ".pdf,.doc,.docx",
  "maxSizeMB": 10,
  "multiple": false
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | string | `"Upload a file"` | Label text |
| `accept` | string | `""` | Accepted file types |
| `maxSizeMB` | number | `10` | Max file size in MB |
| `multiple` | boolean | `false` | Allow multiple files |

---

## Handling Actions

All action components emit a `livellm:action` CustomEvent:

```javascript
LiveLLM.onAction((action) => {
  console.log(action.component);  // "choice", "confirm", etc.
  console.log(action.action);     // "select", "confirm", "submit", etc.
  console.log(action.data);       // { value: ..., label: ... }
});
```

---

## Streaming Usage

```javascript
// Manual push
const stream = LiveLLM.stream('#output');
stream.push(token);  // Push text token by token
stream.end();        // Finalize

// From fetch ReadableStream
const response = await fetch('/api/chat', { method: 'POST', body: '...' });
const stream = LiveLLM.stream('#output');
await stream.connectStream(response.body, (chunk) => {
  // Extract token from SSE/JSON chunk
  const data = JSON.parse(chunk);
  return data.choices?.[0]?.delta?.content || '';
});

// From SSE (EventSource)
const source = new EventSource('/api/stream');
const stream = LiveLLM.stream('#output');
stream.connectSSE(source, {
  extractToken: (data) => JSON.parse(data).token,
  doneSignal: '[DONE]'
});

// From WebSocket
const ws = new WebSocket('wss://api.example.com/chat');
const stream = LiveLLM.stream('#output');
stream.connectWebSocket(ws, {
  extractToken: (msg) => JSON.parse(msg.data).content,
  doneSignal: '[DONE]'
});
```

---

## Theming

LiveLLM uses CSS custom properties. Override them on any container:

```css
.my-chat {
  --livellm-primary: #6c5ce7;
  --livellm-text: #1a1a1a;
  --livellm-text-secondary: #6c757d;
  --livellm-bg: #ffffff;
  --livellm-bg-secondary: #f8f9fa;
  --livellm-bg-component: #ffffff;
  --livellm-border: #e0e0e0;
  --livellm-border-radius: 8px;
  --livellm-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  --livellm-font: system-ui, -apple-system, sans-serif;
  --livellm-font-size: 14px;
  --livellm-line-height: 1.6;
  --livellm-success: #00b894;
  --livellm-danger: #ff6b6b;
  --livellm-warning: #fdcb6e;
}
```

Built-in themes: `default`, `dark`, `minimal`

```javascript
LiveLLM.setTheme('dark');
```

---

## Full Example — LLM Response

````markdown
# Sales Report Q1 2026

`livellm:alert{"type":"success","text":"Data updated as of February 2026"}`

## Revenue by Region

```livellm:chart
{
  "type": "bar",
  "title": "Q1 Revenue",
  "labels": ["North", "South", "East", "West"],
  "datasets": [
    { "label": "Revenue ($K)", "data": [120, 85, 95, 110] }
  ]
}
```

## Top Products

```livellm:table-plus
{
  "columns": [
    { "key": "product", "label": "Product" },
    { "key": "sales", "label": "Sales", "type": "number", "sortable": true },
    { "key": "revenue", "label": "Revenue", "type": "number", "sortable": true }
  ],
  "rows": [
    { "product": "Widget A", "sales": 1250, "revenue": 45000 },
    { "product": "Widget B", "sales": 890, "revenue": 32000 },
    { "product": "Widget C", "sales": 650, "revenue": 28000 }
  ]
}
```

**Total Revenue:** $15,246.50

Would you like to drill down into a specific region?

```livellm:choice
{
  "question": "Select a region to analyze:",
  "options": ["North", "South", "East", "West"]
}
```
````
