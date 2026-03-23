# LiveLLM — Architecture Views

> Auto-generated architecture documentation

---

### SECTION: OVERVIEW

```mermaid
graph TD
    subgraph External
        LLM[LLM Provider]
        UserApp[Host Application]
        Browser[Browser DOM]
    end

    subgraph LiveLLM
        Facade[LiveLLMInstance Facade]
        Parser[Parser<br/>markdown-it + plugin]
        Transformer[Transformer<br/>detector pipeline]
        Renderer[Renderer<br/>DOM insertion]
        StreamRenderer[StreamRenderer<br/>char-level state machine]
        Registry[Registry<br/>component + schema]
        Events[EventBus<br/>cross-cutting]
        Actions[Actions<br/>bidirectional routing]
        Observer[Observer<br/>MutationObserver]
    end

    subgraph Components
        Block[15 Block Components]
        Inline[7 Inline Components]
        Action[8 Action Components]
    end

    subgraph Themes
        Default[default.css]
        Dark[dark.css]
        Minimal[minimal.css]
    end

    LLM -->|markdown stream| UserApp
    UserApp -->|render / stream| Facade
    Facade --> Parser
    Facade --> Transformer
    Facade --> Renderer
    Facade --> StreamRenderer
    Facade --> Registry
    Facade --> Events
    Facade --> Actions
    Facade --> Observer

    Parser -->|HTML tokens| Renderer
    Transformer -->|rewritten markdown| Parser
    Renderer -->|DOM elements| Browser
    StreamRenderer -->|incremental DOM| Browser
    Registry -->|validates & resolves| Components
    Observer -->|auto-processes| Renderer

    Components -->|livellm:action events| Actions
    Actions -->|onAction callback| UserApp
    Themes -->|CSS custom properties| Components
```

---

### SECTION: SERVICES

```mermaid
graph LR
    subgraph Input
        MD[Raw Markdown]
        SSE[SSE / WebSocket Stream]
    end

    subgraph "Core Pipeline"
        T[Transformer]
        P[Parser]
        R[Renderer]
        SR[StreamRenderer]
    end

    subgraph "Support Services"
        REG[Registry]
        EVT[EventBus]
        ACT[Actions]
        OBS[Observer]
    end

    subgraph Output
        DOM[DOM Elements]
        CB[Action Callbacks]
    end

    MD -->|plain markdown| T
    T -->|livellm: blocks injected| P
    P -->|HTML string| R
    R -->|mounted elements| DOM

    SSE -->|tokens| SR
    SR -->|skeleton → final DOM| DOM

    REG -->|schema validation| R
    REG -->|schema validation| SR
    EVT -->|event routing| ACT
    ACT -->|onAction / preview| CB
    OBS -->|dynamic content| R

    R -.->|livellm:action| EVT
    DOM -.->|user interaction| EVT
```

---

### SECTION: FLOWS

#### Flow: Static Render

```mermaid
sequenceDiagram
    participant App as Host Application
    participant Facade as LiveLLMInstance
    participant Transformer as Transformer
    participant Parser as Parser
    participant Registry as Registry
    participant Renderer as Renderer
    participant DOM as Browser DOM

    App->>Facade: render(markdown, container)
    Facade->>Transformer: transform(markdown)
    Transformer->>Transformer: run detectors (table, question, address, code, link, list, data)
    Transformer->>Transformer: resolve overlaps by confidence
    Transformer-->>Facade: rewritten markdown with livellm: blocks
    Facade->>Parser: parse(rewrittenMarkdown)
    Parser->>Parser: markdown-it + custom fence/code_inline rules
    Parser-->>Facade: HTML string with Web Component placeholders
    Facade->>Renderer: render(html, container)
    Renderer->>Registry: validate props (JSON schema)
    Registry-->>Renderer: validated props / defaults
    Renderer->>DOM: insert HTML, upgrade custom elements
    DOM-->>App: rendered interactive UI
```

#### Flow: Token Streaming

```mermaid
sequenceDiagram
    participant App as Host Application
    participant Facade as LiveLLMInstance
    participant SR as StreamRenderer
    participant Registry as Registry
    participant DOM as Browser DOM

    App->>Facade: createStream(container)
    Facade-->>App: stream controller

    loop Each token from LLM
        App->>SR: push(token)
        SR->>SR: char-level state machine (IDLE→TEXT→FENCE_MAYBE→COMPONENT→DONE)
        alt Plain text
            SR->>DOM: append text (RAF batched)
        else Component block detected
            SR->>DOM: insert skeleton placeholder
            SR->>SR: accumulate JSON props
        end
        alt JSON complete
            SR->>Registry: validate props
            SR->>DOM: replace skeleton with rendered component
        end
    end

    App->>SR: end()
    SR->>DOM: finalize all pending blocks
```

#### Flow: Action Lifecycle

```mermaid
sequenceDiagram
    participant User as User
    participant Comp as Action Component
    participant Shadow as Shadow DOM
    participant Events as EventBus
    participant Actions as Actions Module
    participant App as Host Application

    User->>Shadow: interact (click/select/input)
    Shadow->>Comp: event handler
    Comp->>Comp: lock state (submitted = true)
    Comp->>Comp: re-render confirmation UI
    Comp->>Shadow: dispatch CustomEvent(livellm:action)
    Note over Shadow: bubbles: true, composed: true
    Shadow->>Events: event crosses Shadow DOM boundary
    Events->>Actions: route action

    alt autoSend mode
        Actions->>App: onAction(actionData)
    else preview mode
        Actions->>App: onPreview(actionData)
        App->>Actions: confirm()
        Actions->>App: onAction(actionData)
    end
```

#### Flow: Observer Auto-Processing

```mermaid
sequenceDiagram
    participant External as External Code
    participant DOM as Browser DOM
    participant Observer as Observer Module
    participant Renderer as Renderer

    External->>DOM: inject dynamic HTML with livellm: code blocks
    DOM->>Observer: MutationObserver fires
    Observer->>Observer: debounce mutations
    Observer->>Observer: scan for unprocessed livellm: blocks
    Observer->>Renderer: process detected blocks
    Renderer->>DOM: replace code blocks with Web Components
```

#### Flow: Detector Pipeline

```mermaid
sequenceDiagram
    participant Transformer as Transformer
    participant TD as Table Detector
    participant QD as Question Detector
    participant AD as Address Detector
    participant CD as Code Detector
    participant LD as Link Detector
    participant LiD as List Detector
    participant DD as Data Detector

    Transformer->>TD: detect(markdown)
    TD-->>Transformer: DetectionMatch[] + confidence
    Transformer->>QD: detect(markdown)
    QD-->>Transformer: DetectionMatch[] + confidence
    Transformer->>AD: detect(markdown)
    AD-->>Transformer: DetectionMatch[] + confidence
    Transformer->>CD: detect(markdown)
    CD-->>Transformer: DetectionMatch[] + confidence
    Transformer->>LD: detect(markdown)
    LD-->>Transformer: DetectionMatch[] + confidence
    Transformer->>LiD: detect(markdown)
    LiD-->>Transformer: DetectionMatch[] + confidence
    Transformer->>DD: detect(markdown)
    DD-->>Transformer: DetectionMatch[] + confidence

    Transformer->>Transformer: merge all matches
    Transformer->>Transformer: resolve overlaps (highest confidence wins)
    Transformer->>Transformer: sort by position (reverse order)
    Transformer->>Transformer: apply transforms (replace text with livellm: blocks)
```

---

### SECTION: MODULES

```mermaid
graph TD
    subgraph "src/index.ts"
        Singleton[LiveLLM Singleton<br/>pre-registers 30 components]
    end

    subgraph "src/core/"
        LLMFacade[livellm.ts<br/>LiveLLMInstance facade]
        Parser[parser.ts<br/>markdown-it plugin]
        Transformer[transformer.ts<br/>detector orchestrator]
        Renderer[renderer.ts<br/>DOM rendering]
        StreamRenderer[stream-renderer.ts<br/>char state machine]
        Registry[registry.ts<br/>JSON schema validation]
        Events[events.ts<br/>EventBus]
        Actions[actions.ts<br/>action routing]
        Observer[observer.ts<br/>MutationObserver]
    end

    subgraph "src/components/"
        Base[base.ts<br/>LiveLLMComponent]

        subgraph "block/ (15)"
            Tabs[tabs]
            Map[map]
            Chart[chart]
            Form[form]
            TablePlus[table-plus]
            Accordion[accordion]
            Steps[steps]
            Timeline[timeline]
            Video[video]
            Pricing[pricing]
            Carousel[carousel]
            FilePreview[file-preview]
            Calendar[calendar]
            LinkPreview[link-preview]
            CodeRunner[code-runner]
        end

        subgraph "inline/ (7)"
            Alert[alert]
            Badge[badge]
            Progress[progress]
            Tooltip[tooltip]
            Rating[rating]
            Counter[counter]
            Tag[tag]
        end

        subgraph "action/ (8)"
            Choice[choice]
            Confirm[confirm]
            MultiChoice[multi-choice]
            RatingInput[rating-input]
            DatePicker[date-picker]
            TextInput[text-input]
            Slider[slider]
            FileUpload[file-upload]
        end
    end

    subgraph "src/detectors/"
        TableDet[table.ts]
        QuestionDet[question.ts]
        AddressDet[address.ts]
        CodeDet[code.ts]
        LinkDet[link.ts]
        ListDet[list.ts]
        DataDet[data.ts]
    end

    subgraph "src/themes/"
        DefaultTheme[default.css]
        DarkTheme[dark.css]
        MinimalTheme[minimal.css]
    end

    subgraph "src/utils/"
        Types[types.ts]
        Validation[validation.ts]
        JSONParsing[json-parse.ts]
        DOMHelpers[dom.ts]
        Sanitization[sanitize.ts]
    end

    subgraph "src/protocol/"
        ParseSSE[parseSSE]
        ConnectStream[connectStream]
        CreateSSEWriter[createSSEWriter]
    end

    Singleton --> LLMFacade
    LLMFacade --> Parser
    LLMFacade --> Transformer
    LLMFacade --> Renderer
    LLMFacade --> StreamRenderer
    LLMFacade --> Registry
    LLMFacade --> Events
    LLMFacade --> Actions
    LLMFacade --> Observer

    Transformer --> TableDet
    Transformer --> QuestionDet
    Transformer --> AddressDet
    Transformer --> CodeDet
    Transformer --> LinkDet
    Transformer --> ListDet
    Transformer --> DataDet

    Base --> Tabs
    Base --> Map
    Base --> Chart
    Base --> Form
    Base --> TablePlus
    Base --> Accordion
    Base --> Steps
    Base --> Timeline
    Base --> Video
    Base --> Pricing
    Base --> Carousel
    Base --> FilePreview
    Base --> Calendar
    Base --> LinkPreview
    Base --> CodeRunner

    Base --> Alert
    Base --> Badge
    Base --> Progress
    Base --> Tooltip
    Base --> Rating
    Base --> Counter
    Base --> Tag

    Base --> Choice
    Base --> Confirm
    Base --> MultiChoice
    Base --> RatingInput
    Base --> DatePicker
    Base --> TextInput
    Base --> Slider
    Base --> FileUpload
```

---

### SECTION: SUMMARY

{
  "system_name": "LiveLLM",
  "description": "Framework-agnostic JavaScript library that transforms LLM markdown responses into interactive Web Component UIs. Supports streaming, auto-detection, bidirectional actions, and theming.",
  "components": [
    {"name": "LiveLLMInstance (Facade)", "type": "module", "description": "Orchestrates all core modules; singleton exported as LiveLLM with 30 pre-registered components"},
    {"name": "Parser", "type": "module", "description": "markdown-it with custom plugin intercepting livellm: fenced blocks and inline code"},
    {"name": "Transformer", "type": "module", "description": "Runs detectors over plain markdown, auto-converts patterns to livellm: blocks with overlap resolution"},
    {"name": "Renderer", "type": "module", "description": "Renders parsed HTML to DOM elements, validates props via Registry, binds action event listeners"},
    {"name": "StreamRenderer", "type": "module", "description": "Char-level state machine for token-by-token rendering with skeleton placeholders and RAF batching"},
    {"name": "Registry", "type": "module", "description": "Component registration with JSON schema prop validation, defaults, and lazy loading"},
    {"name": "EventBus", "type": "module", "description": "Cross-cutting event system (on/off/once/emit) used by all modules for communication"},
    {"name": "Actions", "type": "module", "description": "Bidirectional action routing: component events to host callbacks with autoSend or preview-confirm flow"},
    {"name": "Observer", "type": "module", "description": "MutationObserver-based auto-processing of livellm: blocks in dynamically inserted DOM content"},
    {"name": "Block Components (15)", "type": "module", "description": "Rich UI blocks: tabs, map, chart, form, table-plus, accordion, steps, timeline, video, pricing, carousel, file-preview, calendar, link-preview, code-runner"},
    {"name": "Inline Components (7)", "type": "module", "description": "Text-flow elements: alert, badge, progress, tooltip, rating, counter, tag"},
    {"name": "Action Components (8)", "type": "module", "description": "Input collectors: choice, confirm, multi-choice, rating-input, date-picker, text-input, slider, file-upload"},
    {"name": "Detectors (7)", "type": "module", "description": "Pattern detectors: table, question, address, code, link, list, data — each with confidence scoring"},
    {"name": "Themes", "type": "module", "description": "CSS custom property system with default (light), dark, and minimal themes"},
    {"name": "Protocol", "type": "module", "description": "SSE client/server helpers: parseSSE, connectStream, createSSEWriter for streaming integration"},
    {"name": "markdown-it", "type": "external", "description": "Sole production dependency (v14) — Markdown parser extended via custom plugin"}
  ],
  "features": [
    {"name": "Phase 0 — Project Setup", "status": "complete", "tasks_done": 0, "tasks_total": 0},
    {"name": "Phase 1 — Core Modules", "status": "complete", "tasks_done": 0, "tasks_total": 0},
    {"name": "Phase 2 — Streaming + Components", "status": "complete", "tasks_done": 0, "tasks_total": 0},
    {"name": "Phase 3 — Transformer Detectors", "status": "complete", "tasks_done": 0, "tasks_total": 0},
    {"name": "Phase 4 — Actions", "status": "complete", "tasks_done": 0, "tasks_total": 0},
    {"name": "Phase 5 — Ecosystem", "status": "complete", "tasks_done": 0, "tasks_total": 0},
    {"name": "feat-claude-md-project-guide", "status": "complete", "tasks_done": 0, "tasks_total": 0}
  ],
  "tech_stack": [
    "TypeScript (strict)",
    "Rollup (UMD + ESM + CJS)",
    "Vitest + happy-dom",
    "ESLint",
    "markdown-it v14",
    "Web Components (Shadow DOM)",
    "CSS Custom Properties"
  ],
  "key_decisions": [
    "Single production dependency (markdown-it) — no chart libs, no UI frameworks",
    "Shadow DOM (open mode) for style isolation across all 30 components",
    "Char-level state machine for streaming instead of regex-based chunk parsing",
    "Detector confidence scoring with overlap resolution for auto-detection",
    "One-shot action pattern: components lock after submission, no undo",
    "CSS custom properties (--livellm-*) for theming rather than CSS-in-JS",
    "Facade pattern: LiveLLMInstance orchestrates all modules behind a single API",
    "CustomEvent with bubbles + composed for crossing Shadow DOM boundaries"
  ]
}
