# Feed Finder - Repository Guidelines

## Project Overview

Feed Finder is a web application that takes a website URL as input, automatically discovers RSS/Atom feeds, and displays the results.

### Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: shadcn/ui + TailwindCSS v4
- **Backend**: Cloudflare Workers
- **Testing**: Vitest
- **Code Quality**: Vite+ (`vp check`: Oxlint + Oxfmt) + lefthook
- **Error Handling**: neverthrow (ResultAsync)

## Project Structure & Module Organization
```
feed-finder/
├── .kiro/specs/           # Specifications
│   ├── requirements.md   # Requirements spec
│   ├── design.md         # Design spec
│   └── tasks.md          # Implementation task list
├── src/                  # React + TypeScript app
│   ├── components/       # React components (e.g., ResultDisplay.tsx)
│   └── lib/              # Utility functions (e.g., utils.ts)
├── worker/               # Cloudflare Worker API (feed discovery, CORS, SSRF protections)
├── public/               # Static assets served by Vite
├── dist/                 # Build output (ignored in VCS)
└── Config files: vite.config.ts, vitest.config.ts, cloudflare.config.ts, lefthook.yml
```

## Build, Test, and Development Commands
- `npm run dev`: Start the dev server (`cf dev`, Vite + Cloudflare plugin).
- `npm run build`: Generate Cloudflare types, type-check, then build app and worker (`cf build`).
- `npm run preview`: Build then serve production preview.
- `npm test`: Run Vitest in watch/interactive mode.
- `npm run test:run`: Run Vitest once for CI.
- `npm run check`: Run Vite+ format and lint checks (Oxfmt + Oxlint) on `src/` and `worker/`.
- `npm run lint` / `npm run fmt`: Run only Oxlint, or apply Oxfmt formatting.
- `npm run deploy`: Build and deploy the worker via the `cf` CLI.
- `npm run cf-typegen`: Generate Cloudflare types into `.cloudflare/types/` (`cf workers types`).
- Cloudflare tooling uses the `cf` CLI (config: `cloudflare.config.ts`). Wrangler is not a project dependency; use `npx wrangler <cmd> --name feed-finder` only for commands `cf` does not support yet.

## Core Development Principles

### 1. TailwindCSS v4 Syntax
- **Use v4 syntax only** (pre-v4 syntax is forbidden).
- Take advantage of new CSS features and custom properties.

### 2. Accessibility
- WCAG 2.2 compliant.
- Semantic HTML, ARIA, and keyboard navigation.
- Touch targets at least 24×24px.

### 3. Performance Targets
- Initial load: under 2 seconds.
- Feed search: under 5 seconds.
- Minimize bundle size.

## Coding Style & Naming Conventions
- Use TypeScript and React function components with hooks.
- Formatting/linting: Oxfmt + Oxlint via Vite+ (2-space indent, double quotes, 80 columns; config in the `fmt` / `lint` blocks of `vite.config.ts`).
- No CommonJS; prefer ESM imports.
- File names: components `PascalCase.tsx` (e.g., `SearchForm.tsx`), utilities `camelCase.ts` (e.g., `variants.ts`).
- Keep modules focused; colocate small helpers under `src/lib/`.
- **Error handling**: leverage neverthrow's ResultAsync.
- **Security**: enforce XSS protection and HTML escaping rigorously.

## Testing Guidelines
- Framework: Vitest (`**/*.{test,spec}.{js,ts,tsx}`), see `vitest.config.ts`.
- Place worker tests under `worker/` (e.g., `worker/integration.test.ts`).
- Naming: mirror the module name with `.test.ts` (`.test.tsx` for components).
- Run tests once with `npm run test:run`. `npm test` starts watch mode and does not exit.
- Aim for practical coverage of parsing, URL validation, and error paths.

## TDD Policy (t-wada style)
- All implementation work follows t-wada style TDD (Red → Green → Refactor) by default.
- First write the smallest failing test, then make it pass with the minimum implementation, and finally refactor.
- For new features and bug fixes, add or strengthen tests before touching the implementation.
- Test placement and naming follow the "Testing Guidelines" above (next to the module under test, mirroring its name).
- Always cover failure cases and boundary values to prevent security and performance regressions.

### Implementation Flow
1. Review the requirements in the spec files (`.kiro/specs/`).
2. **Write a failing test (Red)** — author the smallest failing test.
3. **Make the test pass (Green)** — write the minimum implementation needed.
4. **Refactor** — improve the design without changing behavior.
5. Run integration tests and verify CI.

## Commit & Pull Request Guidelines
- Commits: concise, imperative mood; reference issues/PRs (e.g., "Fix SSRF checks (#15)").
- Branches: `feat/…`, `fix/…`, `chore/…` aligned with scope.
- PRs: clear description, linked issues, test evidence (logs/snapshots), and screenshots for UI changes.
- Ensure `npm run lint` and tests pass before requesting review.

## Security & Configuration Tips
- CORS origins: update `ALLOWED_ORIGINS` in `worker/config.ts` for new domains.
- Do not weaken SSRF checks in `validateTargetUrl`; avoid private/loopback hosts and unusual ports.
- Keep secrets out of the client; use Wrangler/environment configuration for server-side values.

## Internationalization
- Japanese and English support.
- Detect language from the `Accept-Language` header.
- Persist user language preference in local storage.

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
- `vp check` output.
