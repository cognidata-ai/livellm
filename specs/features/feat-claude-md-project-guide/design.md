# Design: feat-claude-md-project-guide

> Created: 2026-03-23 | Author: Hector Curbelo Barrios <hcurbelo@gmail.com>
> Feature: CLAUDE.md Project Guide

## Architecture

Single file creation — no architectural changes. The file is consumed by Claude Code's context loading system.

## Key Design Decisions

### Concise over comprehensive

The CLAUDE.md should contain only information that is non-obvious or requires reading multiple files to understand. Component lists, file trees, and API details are excluded — they live in COMPONENTS.md, LIVELLM.md, and the source code.

### Section structure

| Section | Content |
|---------|---------|
| Header | Standard Claude Code identifier |
| Commands | Build, dev, test (full + single file), lint, typecheck |
| Architecture | Core pipeline, facade pattern, module roles |
| Components | Three categories, base class pattern, Shadow DOM convention |
| Testing | Vitest + happy-dom, globals, known stderr warnings |
| Key conventions | data-props, events, detectors, path alias, themes |

### What NOT to include

- Individual component documentation (COMPONENTS.md)
- Full API reference (LIVELLM.md)
- LLM prompt guide (SKILL.md)
- File tree listings (discoverable via IDE/CLI)
- Generic practices (test writing, security, commit messages)

## Files

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `CLAUDE.md` | Project guide for Claude Code instances |

## No Changes Needed

- No source code changes
- No config changes
- No dependency changes
