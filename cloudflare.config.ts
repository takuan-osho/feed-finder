import { bindings, defineConfig } from "cf/config";

// Static assets are the Vite client build output (`dist/`), so the former
// Wrangler `assets.directory` setting is handled by vite.config.ts.
export default defineConfig({
	worker: {
		name: "feed-finder",
		compatibilityDate: "2025-05-05",
		entrypoint: "worker/index.ts",
		previewUrls: true,
		env: {
			// Per-client limit for POST /api/search-feeds (see worker/http/rateLimit.ts).
			// Each search triggers ~15 outbound requests, so cap abuse as an amplifier.
			RATE_LIMITER: bindings.rateLimit({
				namespace: "1001",
				simple: { limit: 20, period: 60 },
			}),
		},
		observability: {
			traces: {
				enabled: true,
				destinations: ["grafana-traces"],
			},
			logs: {
				enabled: true,
				destinations: ["grafana-logs"],
			},
		},
		assets: {
			notFoundHandling: "single-page-application",
		},
		domains: [
			"feedfinder.programarch.com",
			"feedfinder.takuan-osho.com",
			"feedfinder.takuan-osho.net",
		],
	},
});
