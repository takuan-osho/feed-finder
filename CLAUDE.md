# Feed Finder 改良版 - Claude Code 開発ガイド

## プロジェクト概要

Feed Finder 改良版は、Web サイトの URL 入力から RSS/Atom フィードを自動検索・表示する Web アプリケーションです。

### 技術スタック

- **フロントエンド**: React 19 + TypeScript + Vite
- **UI**: shadcn/ui + TailwindCSS v4
- **バックエンド**: Cloudflare Workers
- **テスト**: Vitest
- **品質管理**: Biome (lint/format) + lefthook
- **エラーハンドリング**: neverthrow (ResultAsync)

## 重要な開発原則

### 1. TDD (Test-Driven Development)

- **t-wada 式 TDD**を厳格に適用
- Red → Green → Refactor サイクルを必ず守る
- 小さなステップで段階的に実装

### 2. TailwindCSS v4 記法

- **v4 記法のみ使用** (v3 以前の記法は禁止)
- 新しい CSS 機能とカスタムプロパティを活用

### 3. アクセシビリティ

- WCAG 2.2 準拠
- セマンティック HTML、ARIA、キーボードナビゲーション
- タッチターゲット 24×24px 以上

## プロジェクト構造

```
feed-finder/
├── .kiro/specs/           # 仕様書
│   ├── requirements.md   # 要件仕様
│   ├── design.md         # 設計仕様
│   └── tasks.md          # 実装タスクリスト
├── src/
│   ├── components/       # Reactコンポーネント
│   └── lib/             # ユーティリティ関数
├── worker/              # Cloudflare Workers用コード
├── .github/workflows/   # CI/CD設定
└── lefthook.yml        # Git hooks設定
```

## 現在の実装状況

### ✅ 完了済み

- プロジェクト基盤セットアップ (React + Vite + TypeScript)
- shadcn/ui + TailwindCSS v4 導入
- 基本 UI コンポーネント (Button, Input, Card, Alert)
- 検索フォームコンポーネント (SearchForm)
- 結果表示コンポーネント (ResultDisplay, FeedCard)
- CI/CD パイプライン (lefthook + GitHub Actions)

### 🚧 実装中/次のタスク

- 型定義とコア関数の実装 (2.1-2.3)
- フィード検索エンジンの実装 (3.1-3.4)
- 国際化システムの実装 (4.1-4.2)

## 開発時の注意事項

### コーディング規約

1. **TypeScript**: 厳格な型定義を使用
2. **エラーハンドリング**: neverthrow の ResultAsync を活用
3. **非同期処理**: Promise.all()で並列処理を最適化
4. **セキュリティ**: XSS 対策、HTML エスケープを徹底

### テスト戦略

- 単体テスト: 各関数の動作確認
- コンポーネントテスト: React Testing Library 使用
- アクセシビリティテスト: 自動化テスト含む

### パフォーマンス要件

- 初回読み込み: 2 秒以内
- フィード検索: 5 秒以内
- バンドルサイズ: 最小化

## 重要なファイル

### 仕様書 (必読)

- `.kiro/specs/requirements.md` - 要件仕様書
- `.kiro/specs/design.md` - 設計仕様書
- `.kiro/specs/tasks.md` - 実装タスクリスト

### 設定ファイル

- `package.json` - 依存関係とスクリプト
- `tsconfig.json` - TypeScript 設定
- `biome.json` - Linter/Formatter 設定
- `lefthook.yml` - Git hooks 設定

### 開発コマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド（型チェック→アプリ・Worker両方ビルド）
npm run preview      # プロダクション版プレビュー
npm run test         # テスト実行（watch/対話モード）
npm run test:run     # テスト実行（CI用・一回のみ）
npm run lint         # Biome Linter実行
npm run deploy       # Cloudflare Workersにデプロイ
npm run cf-typegen   # Cloudflare型定義生成
```

## 実装時のベストプラクティス

### 1. 新機能実装の流れ（t-wada式TDD）

1. 仕様書で要件を確認
2. **TDD でテスト作成 (Red)** - 失敗する最小のテストを書く
3. **最小実装でテスト通過 (Green)** - 必要最小限の実装でグリーンにする
4. **リファクタリング (Refactor)** - コードをよりよい設計に改善
5. 統合テスト実行・CI確認

**重要**: すべての実装は原則 t-wada 式 TDD（Red → Green → Refactor）で進める。セキュリティ・パフォーマンスのregression防止のため、失敗ケース・境界値も必ずカバーする。

### 2. コンポーネント設計

- 単一責任の原則
- Props 型定義の徹底
- アクセシビリティ属性の設定
- TailwindCSS v4 記法でスタイリング
- ファイル命名: コンポーネントは `PascalCase.tsx`（例: `SearchForm.tsx`）
- ユーティリティは `camelCase.ts`（例: `variants.ts`）
- ESM imports使用（CommonJS禁止）

### 3. エラーハンドリング

- neverthrow の Result 型使用
- ユーザーフレンドリーなエラーメッセージ
- 適切な HTTP ステータスコード

### 4. 国際化対応

- 日本語・英語対応
- Accept-Language ヘッダー検出
- ローカルストレージでの言語設定保存

## コミット・PR ガイドライン

### コミットメッセージ
- 簡潔で命令法を使用
- 関連issue・PRを参照（例: "Fix SSRF checks (#15)"）
- ブランチ命名: `feat/…`, `fix/…`, `chore/…`

### プルリクエスト
- 明確な説明とissueリンク
- テスト証跡（ログ・スナップショット）
- UI変更時はスクリーンショット添付
- `npm run lint`とテストが通過していることを確認

## セキュリティ・設定のヒント

### CORS・SSRF対策
- CORS origins: `worker/index.ts`の`ALLOWED_ORIGINS`を更新
- SSRF対策: `validateTargetUrl`のチェックを弱めない
- プライベート・ループバックホストや異常なポートを避ける
- クライアント側にシークレットを含めない
- サーバー側の値はWrangler・環境変数で設定

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

## 参考リンク

- [要件仕様書](.kiro/specs/requirements.md)
- [設計仕様書](.kiro/specs/design.md)
- [実装タスクリスト](.kiro/specs/tasks.md)
- [TailwindCSS v4 Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [neverthrow Documentation](https://github.com/supermacro/neverthrow)

---

このガイドを参考に、効率的で高品質な開発を進めてください。不明な点があれば、仕様書を確認するか、プロジェクトの設計原則に立ち返って判断してください。
