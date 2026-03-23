# Plan: Create CLAUDE.md via SDD

## Context
The repository has no CLAUDE.md. The user wants to follow SDD (Specification-Driven Development) workflow: create specs first, then implement strictly from tasks, then mark tasks as completed.

## Approach
1. Create `specs/features/feat-claude-md-project-guide/` with 3 files:
   - `requirements.md` — What the CLAUDE.md should contain
   - `design.md` — Structure and content decisions
   - `tasks.md` — Checklist of implementation steps
2. Implement CLAUDE.md following the tasks strictly
3. Update tasks.md marking each task as `[x]`

## Key content for CLAUDE.md
- Build/dev/test/lint commands (from package.json)
- How to run a single test
- High-level architecture: facade pattern, core modules, component categories, parser pipeline
- Key conventions: Shadow DOM, data-props, events, detector interface
- Test environment notes (happy-dom, globals, stderr warnings)
- Path alias (@livellm)
- Theme system (CSS custom properties)

## Files to create/modify
- CREATE: `specs/features/feat-claude-md-project-guide/requirements.md`
- CREATE: `specs/features/feat-claude-md-project-guide/design.md`
- CREATE: `specs/features/feat-claude-md-project-guide/tasks.md`
- CREATE: `CLAUDE.md`
- MODIFY: `specs/features/feat-claude-md-project-guide/tasks.md` (mark complete)
