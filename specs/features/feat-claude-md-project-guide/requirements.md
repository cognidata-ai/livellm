# Requirements: feat-claude-md-project-guide

> Created: 2026-03-23 | Author: Hector Curbelo Barrios <hcurbelo@gmail.com>
> Feature: CLAUDE.md Project Guide

## Overview

Create a `CLAUDE.md` file at the repository root that provides essential context for future Claude Code instances operating in this codebase. This file is automatically loaded by Claude Code and serves as persistent project instructions.

## Problem

Without a CLAUDE.md, each new Claude Code session starts with no project-specific context — requiring repeated exploration of build commands, architecture patterns, testing setup, and conventions. This wastes time and leads to inconsistent suggestions.

## Requirements

### Functional

- **R1**: Include all development commands (build, dev, test, lint, typecheck) with exact npm scripts
- **R2**: Document how to run a single test file (not just the full suite)
- **R3**: Describe high-level architecture: facade pattern, core module pipeline, component categories
- **R4**: Document key conventions: Shadow DOM usage, data-props attribute, event patterns, detector interface
- **R5**: Note test environment specifics (happy-dom, vitest globals, stderr warnings from CustomElementRegistry)
- **R6**: Document path alias (`@livellm` → `src/`)
- **R7**: Reference the theme system (CSS custom properties with `--livellm-` prefix)
- **R8**: Document the 3 build output formats (UMD, ESM, CJS)

### Non-Functional

- **R9**: File must be concise — scannable, not exhaustive. Avoid listing every component or file.
- **R10**: No generic development practices or obvious instructions
- **R11**: No duplication of information easily discovered by reading the codebase
- **R12**: Must start with the standard Claude Code header

## Out of Scope

- Documenting individual component props (already in COMPONENTS.md)
- Listing all 30 components (discoverable from code)
- Full API reference (already in LIVELLM.md)
- Generic coding best practices
