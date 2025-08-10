# Feed Finder 改良版 - Repository Guidelines

## プロジェクト概要

Feed Finder 改良版は、Web サイトの URL 入力から RSS/Atom フィードを自動検索・表示する Web アプリケーションです。

### 技術スタック

- **フロントエンド**: React 19 + TypeScript + Vite
- **UI**: shadcn/ui + TailwindCSS v4
- **バックエンド**: Cloudflare Workers
- **テスト**: Vitest
- **品質管理**: Biome (lint/format) + lefthook
- **エラーハンドリング**: neverthrow (ResultAsync)

## Project Structure & Module Organization
```
feed-finder/
├── .kiro/specs/           # 仕様書
│   ├── requirements.md   # 要件仕様
│   ├── design.md         # 設計仕様
│   └── tasks.md          # 実装タスクリスト
├── src/                  # React + TypeScript app
│   ├── components/       # Reactコンポーネント (例: ResultDisplay.tsx)
│   └── lib/             # ユーティリティ関数 (例: utils.ts)
├── worker/              # Cloudflare Worker API (feed discovery, CORS, SSRF protections)
├── public/              # Static assets served by Vite
├── dist/                # Build output (ignored in VCS)
└── Config files: vite.config.ts, vitest.config.ts, wrangler.jsonc, biome.json, lefthook.yml
```

## Build, Test, and Development Commands
- `npm run dev`: Start Vite dev server.
- `npm run build`: Type-check then build app and worker.
- `npm run preview`: Build then serve production preview.
- `npm test`: Run Vitest in watch/interactive mode.
- `npm run test:run`: Run Vitest once for CI.
- `npm run lint`: Run Biome checks on `src/`.
- `npm run deploy`: Build and deploy worker via Wrangler.
- `npm run cf-typegen`: Generate Cloudflare types.

## 重要な開発原則

### 1. TailwindCSS v4 記法
- **v4 記法のみ使用** (v3 以前の記法は禁止)
- 新しい CSS 機能とカスタムプロパティを活用

### 2. アクセシビリティ
- WCAG 2.2 準拠
- セマンティック HTML、ARIA、キーボードナビゲーション
- タッチターゲット 24×24px 以上

### 3. パフォーマンス要件
- 初回読み込み: 2 秒以内
- フィード検索: 5 秒以内
- バンドルサイズ: 最小化

## Coding Style & Naming Conventions
- Use TypeScript and React function components with hooks.
- Formatting/linting: Biome (spaces for indentation, double quotes per `biome.json`).
- No CommonJS; prefer ESM imports.
- File names: components `PascalCase.tsx` (e.g., `SearchForm.tsx`), utilities `camelCase.ts` (e.g., `variants.ts`).
- Keep modules focused; colocate small helpers under `src/lib/`.
- **エラーハンドリング**: neverthrow の ResultAsync を活用
- **セキュリティ**: XSS 対策、HTML エスケープを徹底

## Testing Guidelines
- Framework: Vitest (`**/*.{test,spec}.{js,ts}`), see `vitest.config.ts`.
- Place worker tests under `worker/` (e.g., `worker/integration.test.ts`).
- Naming: mirror the module name with `.test.ts`.
- Run locally with `npm test`; use `npm run test:run` in CI.
- Aim for practical coverage of parsing, URL validation, and error paths.

## TDD方針（t-wada式）
- すべての実装は原則 t-wada 式 TDD（Red → Green → Refactor）で進めてください。
- 先に失敗する最小のテストを書き、必要最小限の実装でグリーンにし、その後リファクタリングします。
- 新規機能やバグ修正は、まずテストを追加/強化してから実装に着手してください。
- テストの配置と命名は上記「Testing Guidelines」に従ってください（`worker/` 配下、対象モジュールに対応した `.test.ts`）。
- セキュリティ/パフォーマンスの回 regressions を防ぐため、失敗ケース・境界値も必ずカバーします。
- CI は `npm run test:run`、ローカル開発は `npm test` を用いて実行します。

**開発者/エージェント向けプロンプト**: 「実装は基本的に t-wada 式の TDD で行います。まず失敗する最小のテストを追加し、そのテストを通す実装を行い、最後にリファクタリングします。」

### 実装フロー
1. 仕様書（`.kiro/specs/`）で要件を確認
2. **TDD でテスト作成 (Red)** - 失敗する最小のテストを書く
3. **最小実装でテスト通過 (Green)** - 必要最小限の実装でグリーンにする  
4. **リファクタリング (Refactor)** - コードをよりよい設計に改善
5. 統合テスト実行・CI確認

## Commit & Pull Request Guidelines
- Commits: concise, imperative mood; reference issues/PRs (e.g., "Fix SSRF checks (#15)").
- Branches: `feat/…`, `fix/…`, `chore/…` aligned with scope.
- PRs: clear description, linked issues, test evidence (logs/snapshots), and screenshots for UI changes.
- Ensure `npm run lint` and tests pass before requesting review.

## Security & Configuration Tips
- CORS origins: update `ALLOWED_ORIGINS` in `worker/index.ts` for new domains.
- Do not weaken SSRF checks in `validateTargetUrl`; avoid private/loopback hosts and unusual ports.
- Keep secrets out of the client; use Wrangler/environment configuration for server-side values.

## 国際化対応
- 日本語・英語対応
- Accept-Language ヘッダー検出  
- ローカルストレージでの言語設定保存

## トラブルシューティング

### よくある問題
1. **TailwindCSS v3 記法の使用**: v4 記法に変更
2. **型エラー**: 厳格な型定義を確認
3. **テスト失敗**: TDD サイクルを再確認
4. **ビルドエラー**: 依存関係と TypeScript 設定を確認

### デバッグ方法
- ブラウザ開発者ツール
- Vite の開発サーバーログ
- Vitest のテスト結果
- Biome の lint 結果
