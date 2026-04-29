# Feed Finder - Claude Code Development Guide

## Project Overview

Feed Finder is a web application that takes a website URL as input and automatically discovers and displays RSS/Atom feeds.

### Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: shadcn/ui + TailwindCSS v4
- **Backend**: Cloudflare Workers
- **Testing**: Vitest
- **Code Quality**: Biome (lint/format) + lefthook
- **Error Handling**: neverthrow (ResultAsync)

## Core Development Principles

### 1. TDD (Test-Driven Development)

- Apply **t-wada style TDD** strictly.
- Always follow the Red → Green → Refactor cycle.
- Implement incrementally in small steps.

### 2. TailwindCSS v4 Syntax

- **Use v4 syntax only** (pre-v4 syntax is forbidden).
- Take advantage of new CSS features and custom properties.

### 3. Accessibility

- WCAG 2.2 compliant.
- Semantic HTML, ARIA, and keyboard navigation.
- Touch targets at least 24×24px.

## Project Structure

```
feed-finder/
├── .kiro/specs/           # Specifications
│   ├── requirements.md   # Requirements spec
│   ├── design.md         # Design spec
│   └── tasks.md          # Implementation task list
├── src/
│   ├── components/       # React components
│   └── lib/              # Utility functions
├── worker/              # Cloudflare Workers code
├── .github/workflows/   # CI/CD configuration
└── lefthook.yml         # Git hooks configuration
```

## Current Implementation Status

### Done

- Project foundation (React + Vite + TypeScript)
- shadcn/ui + TailwindCSS v4 setup
- Base UI components (Button, Input, Card, Alert)
- Search form component (SearchForm)
- Result display components (ResultDisplay, FeedCard)
- CI/CD pipeline (lefthook + GitHub Actions)

### In Progress / Up Next

- Type definitions and core function implementation (2.1-2.3)
- Feed discovery engine (3.1-3.4)
- Internationalization system (4.1-4.2)

## Development Notes

### Coding Conventions

1. **TypeScript**: use strict type definitions.
2. **Error handling**: leverage neverthrow's ResultAsync.
3. **Async work**: parallelize with `Promise.all()` where it helps.
4. **Security**: enforce XSS protection and HTML escaping rigorously.

### Testing Strategy

- Unit tests: verify behavior of individual functions.
- Component tests: use React Testing Library.
- Accessibility tests: include automated checks.

### Performance Targets

- Initial load: under 2 seconds.
- Feed search: under 5 seconds.
- Minimize bundle size.

## Important Files

### Specifications (Required Reading)

- `.kiro/specs/requirements.md` - Requirements spec
- `.kiro/specs/design.md` - Design spec
- `.kiro/specs/tasks.md` - Implementation task list

### Configuration Files

- `package.json` - dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `biome.json` - linter/formatter configuration
- `lefthook.yml` - Git hooks configuration

### Development Commands

```bash
npm run dev          # Start the dev server
npm run build        # Production build (type-check then build app + worker)
npm run preview      # Preview the production build
npm run test         # Run tests (watch / interactive mode)
npm run test:run     # Run tests once (for CI)
npm run lint         # Run the Biome linter
npm run deploy       # Deploy to Cloudflare Workers
npm run cf-typegen   # Generate Cloudflare type definitions
```

## Implementation Best Practices

### 1. New Feature Workflow (t-wada style TDD)

1. Confirm requirements in the spec files.
2. **Write a failing test (Red)** — author the smallest failing test.
3. **Make the test pass (Green)** — write the minimum implementation needed.
4. **Refactor** — improve the design without changing behavior.
5. Run integration tests and verify CI.

**Important**: All implementation work follows the t-wada Red → Green → Refactor cycle. Always cover failure cases and boundary values to prevent security and performance regressions.

### 2. Component Design

- Single Responsibility Principle.
- Strict Props type definitions.
- Apply accessibility attributes.
- Style with TailwindCSS v4 syntax.
- File naming: components use `PascalCase.tsx` (e.g., `SearchForm.tsx`).
- Utilities use `camelCase.ts` (e.g., `variants.ts`).
- Use ESM imports (CommonJS is forbidden).

### 3. Error Handling

- Use neverthrow's Result type.
- User-friendly error messages.
- Appropriate HTTP status codes.

### 4. Internationalization

- Japanese and English support.
- Detect language from the `Accept-Language` header.
- Persist user language preference in local storage.

## Commit & PR Guidelines

### Commit Messages
- Concise and in the imperative mood.
- Reference related issues/PRs (e.g., "Fix SSRF checks (#15)").
- Branch naming: `feat/…`, `fix/…`, `chore/…`.

### Pull Requests
- Clear description with linked issues.
- Test evidence (logs / snapshots).
- Attach screenshots for UI changes.
- Confirm `npm run lint` and tests pass.

## Security & Configuration Tips

### CORS / SSRF
- CORS origins: update `ALLOWED_ORIGINS` in `worker/index.ts`.
- SSRF: do not weaken the checks in `validateTargetUrl`.
- Avoid private/loopback hosts and unusual ports.
- Keep secrets out of the client.
- Provide server-side values via Wrangler / environment variables.

## Troubleshooting

### Common Issues

1. **Pre-v4 TailwindCSS syntax in use**: migrate to v4 syntax.
2. **Type errors**: review the strict type definitions.
3. **Failing tests**: revisit the TDD cycle.
4. **Build errors**: check dependencies and TypeScript configuration.

### Debugging

- Browser dev tools.
- Vite dev server logs.
- Vitest test output.
- Biome lint output.

## References

- [Requirements spec](.kiro/specs/requirements.md)
- [Design spec](.kiro/specs/design.md)
- [Implementation task list](.kiro/specs/tasks.md)
- [TailwindCSS v4 Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [neverthrow Documentation](https://github.com/supermacro/neverthrow)

---

Use this guide as a reference for efficient, high-quality development. When in doubt, consult the spec files or fall back on the project's design principles.
