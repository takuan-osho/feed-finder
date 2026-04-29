# Feed Finder - Implementation Task List

## Plan Overview

This implementation plan breaks Feed Finder down into tasks based on the requirements and design specs. Each task can be executed independently, **applying t-wada style TDD (Red-Green-Refactor) strictly** as we incrementally build the system.

## TDD Implementation Principles

### Mandatory Practices

1. **Red phase**: always write a failing test first.
2. **Green phase**: implement only the minimum needed to make tests pass.
3. **Refactor phase**: improve the implementation without changing the tests.
4. **Small steps**: implement one thing at a time.
5. **Continuous execution**: run tests after each step.

## Task List

- [x] 1. Project foundation

  - Set up React 19 + Vite + TypeScript.
  - Introduce shadcn/ui + TailwindCSS v4.
  - Adopt TailwindCSS v4 syntax (pre-v4 syntax forbidden).
  - Update the Cloudflare Workers environment.
  - Introduce `node-html-parser` (for HTML parsing).
  - Introduce neverthrow (for error handling).
  - Support Node.js 20.19.4+.
  - Establish a basic build / deploy pipeline.
  - _Requirements: 5 (performance and security)._

- [x] 2. Type definitions and core functions

  - [x] 2.1 Define base types

    - Define `FeedResult`, `SearchResult`, and `FeedSearchError` types.
    - Define i18n-related types (`Language`, `Messages`).
    - Define Props types for React components.
    - _Requirements: 1 (feed discovery), 6 (i18n)._

  - [x] 2.2 TDD implementation of URL normalization

    - **Red**: write a test for URLs without a protocol (must fail).
    - **Green**: minimum implementation to make the test pass.
    - **Refactor**: improve the code and add error handling.
    - **Red**: write a test for `http` → `https` upgrade.
    - **Green**: minimum implementation of the conversion.
    - **Refactor**: add URL validation.
    - _Requirements: 3 (URL normalization and error handling), 8 (TDD)._

  - [x] 2.3 TDD implementation of HTML escaping
    - **Red**: write a test for basic HTML escaping.
    - **Green**: minimum escaping implementation.
    - **Refactor**: cover every dangerous character.
    - **Red**: add tests for XSS attack patterns.
    - **Green**: tighten security accordingly.
    - _Requirements: 5 (performance and security), 8 (TDD)._

- [x] 3. Feed discovery engine

  - [x] 3.1 HTML meta-tag parsing

    - Implement `extractFeedLinksFromHtml`.
    - Conform to the RSS Autodiscovery standard.
    - Convert relative URLs to absolute URLs.
    - Detect feed types (RSS / Atom).
    - _Requirements: 2 (multi-stage search strategy)._

  - [x] 3.2 Feed existence check

    - Implement `checkFeedExists`.
    - Use HEAD requests for efficiency.
    - Handle network errors.
    - _Requirements: 2 (multi-stage search), 5 (performance and security)._

  - [x] 3.3 Common-path discovery

    - Implement `findCommonPathFeeds`.
    - Define the common feed paths.
    - Speed it up via parallel processing.
    - _Requirements: 2 (multi-stage search)._

  - [x] 3.4 Main search function
    - Implement `searchFeeds`.
    - Implement the staged search strategy.
    - Use `ResultAsync` for async error handling.
    - De-duplicate feeds.
    - _Requirements: 1 (feed discovery), 2 (multi-stage search)._

- [ ] 4. Internationalization system

  - [ ] 4.1 Server-side i18n

    - Detect language from the `Accept-Language` header.
    - Manage server-side messages.
    - Set the language during initial HTML render.
    - _Requirements: 6 (i18n)._

  - [ ] 4.2 Client-side i18n
    - Manage language state via React Context.
    - Persist preference in local storage.
    - Switch language dynamically.
    - Manage translation messages.
    - _Requirements: 6 (i18n)._

- [ ] 5. React components

  - [x] 5.1 Base UI components

    - Set up shadcn/ui components.
    - Add Button, Input, Card, and Alert components.
    - Style with TailwindCSS v4 syntax (pre-v4 syntax not used).
    - _Requirements: 4 (user interface)._

  - [x] 5.2 Search form component

    - Implement the `SearchForm` component.
    - URL input validation.
    - Submission handling and loading state.
    - Accessibility (ARIA, keyboard navigation).
    - _Requirements: 4 (user interface), 8 (accessibility)._

  - [x] 5.3 Result display component

    - Implement the `ResultDisplay` component.
    - Implement the `FeedCard` component.
    - Implement the error display.
    - Implement success and warning alerts.
    - _Requirements: 4 (user interface)._

  - [ ] 5.4 Language toggle component
    - Implement the `LanguageToggle` component.
    - Manage the language state.
    - Provide visual feedback.
    - _Requirements: 6 (i18n)._

- [ ] 6. Local storage features

  - [ ] 6.1 Search history

    - Save / load search history.
    - Display and selection of history.
    - Clear history.
    - _Requirements: 10 (search history and favorites)._

  - [ ] 6.2 Favorites
    - Save / load feed information.
    - Display the favorites list.
    - Remove favorites.
    - _Requirements: 10 (search history and favorites)._

- [x] 7. API endpoints

  - [x] 7.1 Search API endpoint

    - Implement `POST /api/search`.
    - Implement the JSON API response.
    - Standardize error responses.
    - _Requirements: 1 (feed discovery)._

  - [ ] 7.2 SSR page endpoint
    - Implement the `GET /` main page.
    - Implement React SSR.
    - Handle initial language settings.
    - _Requirements: 4 (user interface), 6 (i18n)._

- [x] 8. Accessibility implementation

  - [x] 8.1 WCAG 2.2 basics

    - Implement semantic HTML.
    - Apply ARIA labels appropriately.
    - Implement keyboard navigation.
    - Manage focus (Focus Not Obscured).
    - _Requirements: 9 (accessibility)._

  - [ ] 8.2 Touch accessibility
    - Optimize touch target sizes (≥ 24×24px).
    - Improve mobile usability.
    - Implement responsive design with TailwindCSS v4 syntax.
    - _Requirements: 9 (accessibility)._

- [x] 9. Performance optimization

  - [x] 9.1 Async optimization

    - Implement parallel processing with `Promise.all()` (in `tryCommonPaths`, pre-validate URLs and run parallel HTTP requests).
    - Optimize `ResultAsync` composition (`discoverFeeds` runs HTML fetch and common-path discovery in parallel).
    - Reduce unnecessary HTTP requests (HEAD probes for content-type, strict feed detection via regex).
    - _Requirements: 5 (performance and security)._

  - [x] 9.2 Bundle optimization
    - Remove unused code (Terser strips console logs, eliminates dead code).
    - Implement code splitting (manual chunking for React, UI, icons; lazy-load `ResultDisplay`).
    - Optimize static resources (`modulepreload`, DNS prefetch, critical CSS).
    - _Requirements: 5 (performance and security)._

- [x] 10. Tests

  - [x] 10.1 Unit tests

    - URL normalization function.
    - HTML escape function.
    - Feed discovery functions.
    - i18n functions.
    - _Requirements: quality coverage of all requirements._

  - [ ] 10.2 Component tests
    - React component tests.
    - User interaction tests.
    - Accessibility tests.
    - _Requirements: 4 (user interface), 9 (accessibility)._

- [x] 11. CI/CD pipeline

  - [x] 11.1 Strengthen Git hooks (lefthook)

    - Add TypeScript type checks (`tsc --noEmit`).
    - Add a dependency vulnerability check (`security-audit: npm audit --audit-level moderate`).
    - Speed things up by splitting pre-commit and pre-push (pre-push optimized to 0.41 s).
    - Scope to the `src` directory to improve developer experience.
    - _Requirements: 7 (CI/CD automation)._

  - [x] 11.2 GitHub Actions workflows

    - Create `.github/workflows/ci.yml`.
    - Run Biome lint / format / type check automatically.
    - Run tests automatically on pull requests.
    - Integrate the security audit.
    - _Requirements: 7 (CI/CD automation)._

  - [x] 11.3 Deployment workflow

    - Document the manual deploy procedure.
    - **Change**: automatic deploys are disabled; manual deploys are recommended.
    - **Reason**: for security and control.
    - _Requirements: 7 (CI/CD automation)._

  - [x] 11.4 Security scanning
    - Create `.github/workflows/security.yml`.
    - Vulnerability scanning (`npm audit` + dependency review).
    - Static analysis with CodeQL.
    - Weekly schedule.
    - Persist security results as artifacts.
    - _Requirements: 7 (CI/CD automation)._

- [ ] 12. Integration and deployment

  - [ ] 12.1 Integration tests

    - End-to-end tests.
    - API integration tests.
    - Browser compatibility tests.
    - _Requirements: integrate-test all requirements._

  - [ ] 12.2 Production deploy
    - Deploy to Cloudflare Workers.
    - Configure custom domains.
    - Set up monitoring and logging.
    - _Requirements: 5 (performance and security)._

## Optional Features (Second Priority)

- [ ] 13. Batch search

  - Multi-URL input UI.
  - Batch processing engine.
  - Result export.
  - _Requirements: 11 (batch search)._

- [ ] 14. Feed detail information
  - Parse feed contents.
  - Show the latest entries.
  - Estimate update frequency.
  - _Requirements: 12 (feed details)._
