# Feed Finder - Claude Code Development Guide

## Project Overview

Feed Finder is a web application that takes a website URL as input and automatically discovers and displays RSS/Atom feeds.

## Core Development Principles

### 1. TDD (Test-Driven Development)

- Use t-wada style TDD: Red → Green → Refactor (workflow below).
- Implement incrementally in small steps.

### 2. TailwindCSS v4 Syntax

- **Use v4 syntax only** (pre-v4 syntax is forbidden).
- Take advantage of new CSS features and custom properties.

### 3. Accessibility

- WCAG 2.2 compliant.
- Semantic HTML, ARIA, and keyboard navigation.
- Touch targets at least 24×24px.

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
- `.kiro/specs/tasks.md` - Implementation task list (also tracks implementation status)

### Running Tests

- Use `npm run test:run` to run tests once. `npm run test` starts watch mode and does not exit.

## Implementation Best Practices

### 1. New Feature Workflow (t-wada style TDD)

1. Confirm requirements in the spec files.
2. **Write a failing test (Red)** — author the smallest failing test.
3. **Make the test pass (Green)** — write the minimum implementation needed.
4. **Refactor** — improve the design without changing behavior.
5. Run integration tests and verify CI.

Cover failure cases and boundary values in tests, to prevent security and performance regressions.

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
- CORS origins: update `ALLOWED_ORIGINS` in `worker/config.ts`.
- SSRF: do not weaken the checks in `validateTargetUrl`.
- Avoid private/loopback hosts and unusual ports.
- Keep secrets out of the client.
- Provide server-side values via Wrangler / environment variables.
