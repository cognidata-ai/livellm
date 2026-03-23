# action

## Purpose
Eight interactive Web Components that collect user input within LLM chat responses. Each component renders a self-contained UI in Shadow DOM, captures a single interaction (locked after submission), and emits a `livellm:action` CustomEvent with the result for the host application to handle.

## Key Components
- `LiveLLMChoice` — single-select radio-style option picker
- `LiveLLMConfirm` — yes/no confirmation dialog with customizable button labels
- `LiveLLMDatePicker` — date or datetime-local input with optional min/max constraints
- `LiveLLMFileUpload` — drag-and-drop / click-to-browse file selector with size/type hints
- `LiveLLMMultiChoice` — multi-select checkbox picker with configurable min/max selection counts
- `LiveLLMRatingInput` — star rating widget with hover preview and optional low/high labels
- `LiveLLMSlider` — range slider with configurable min/max/step/suffix and live value display
- `LiveLLMTextInput` — single-line or multiline text input with optional char limit and hint

## Exports / Public Interface
Each file exports the component class and a `*_REGISTRATION` constant (`RegisterOptions`) containing the JSON schema for prop validation, category (`'action'`), and skeleton placeholder HTML for streaming. Components emit `livellm:action` CustomEvents with `{ value, label, ...extras }` payloads via `emitAction()`.

## Dependencies
- `../base` (`LiveLLMComponent`) — base class providing Shadow DOM, `_props`, `setStyles()`, `setContent()`, `emitAction()`, `escapeHtml()`
- `../../core/registry` (`RegisterOptions`) — type import only

## Notes
- All components use a **one-shot** pattern: once submitted, state is locked (`submitted = true`), inputs disabled, and the component re-renders to show confirmation text. No undo.
- Styles use `--livellm-*` CSS custom properties for theming; primary color defaults to `#6c5ce7`.
- Options arrays accept both `string` and `{ label, value }` object formats, normalized internally.
- `escapeHtml` is re-implemented locally in several components rather than inherited — minor duplication.