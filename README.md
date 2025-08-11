# Feed Finder

A web application that automatically discovers RSS and Atom feeds from any website URL.

[![Status](https://img.shields.io/badge/Status-Production%20Ready-green)](https://feedfinder.takuan-osho.com)
[![React](https://img.shields.io/badge/React-19-blue)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](#)

## Demo

https://feedfinder.takuan-osho.com

## Features

- **Automatic feed discovery**: Simply enter a URL to find RSS/Atom feeds
- **Multi-strategy search**: HTML meta tag analysis + common path exploration in parallel
- **Fast performance**: Optimized bundle (~180KB) with sub-2s initial load
- **Security-focused**: Built-in SSRF protection, XSS prevention
- **Responsive design**: Works on mobile and desktop

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: shadcn/ui + TailwindCSS v4
- **Backend**: Cloudflare Workers
- **Testing**: Vitest (63 tests passing)
- **Code Quality**: Biome (lint/format) + lefthook
- **Error Handling**: neverthrow

## Requirements

- Node.js 20.19.4 or higher
- npm or yarn

## Quick Start

```bash
# Clone the repository
git clone https://github.com/takuan-osho/feed-finder.git
cd feed-finder

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests (watch mode)
npm run test

# Run tests (single run)
npm run test:run

# Lint code
npm run lint

# Deploy to Cloudflare Workers
npm run deploy
```

## Project Structure

```
feed-finder/
├── src/                    # Frontend source
│   ├── components/         # React components
│   │   ├── ui/            # Base UI components
│   │   ├── SearchForm.tsx # Search form component
│   │   └── ResultDisplay.tsx # Results display
│   ├── lib/               # Utility functions
│   └── App.tsx            # Main app component
├── worker/                # Cloudflare Workers
│   ├── index.ts          # API implementation
│   └── *.test.ts         # Test files
├── .kiro/specs/          # Project specifications
└── .github/workflows/    # CI/CD configuration
```

## Testing

This project follows Test-Driven Development (TDD):

- **63 tests** all passing
- **Performance tests** for parallel processing
- **Bundle optimization tests**
- **Security tests** (SSRF, XSS protection)

## Configuration

### Adding Allowed Domains

Add domains to the `ALLOWED_ORIGINS` array in `worker/index.ts`:

```typescript
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://yourdomain.com", // Add your domain
];
```

### Customizing Styles

This project uses TailwindCSS v4. Edit styles in any component within the `src/` directory.

## Performance

- **Initial load**: Under 2 seconds
- **Feed search**: Under 5 seconds
- **Bundle size**: ~180KB (58KB gzipped)
- **Parallel processing**: HTML parsing and common path search run concurrently

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the [GNU Affero General Public License v3](LICENSE).
