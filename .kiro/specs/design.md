# Feed Finder 改良版 - 設計仕様書

## 概要

本設計書では、Feed Finder 改良版のアーキテクチャ設計を Architecture Decision Record（ADR）形式で記録します。各設計判断の背景、選択肢、決定理由を明確に文書化し、将来の保守や拡張時の参考とします。

## ADR-001: プラットフォーム選択

### ステータス

承認済み

### コンテキスト

Web アプリケーションのホスティングプラットフォームを選択する必要がある。要件として、高速なレスポンス、グローバル配信、コスト効率性が求められる。

### 検討した選択肢

1. **Cloudflare Workers** - エッジコンピューティングプラットフォーム
2. **Vercel** - フロントエンド特化のホスティング
3. **AWS Lambda** - サーバーレス関数
4. **従来の VPS** - 仮想プライベートサーバー

### 決定

Cloudflare Workers を選択

### 理由

- **パフォーマンス**: エッジロケーションでの実行により低レイテンシ
- **スケーラビリティ**: 自動スケーリングとグローバル配信
- **コスト**: 無料枠が充実、従量課金制
- **開発体験**: TypeScript 対応、シンプルなデプロイ
- **既存実装**: 現在の実装がすでに Workers 環境で動作

### 影響

- Node.js 固有の API は使用不可
- ランタイム制限（CPU 時間、メモリ）に注意が必要
- Cloudflare エコシステムとの統合が容易

## ADR-002: Web フレームワーク選択

### ステータス

承認済み

### コンテキスト

Cloudflare Workers 環境で動作する Web フレームワークを選択する必要がある。軽量性、型安全性、開発効率性が重要。

### 検討した選択肢

1. **Hono** - 軽量な Web フレームワーク
2. **Itty Router** - 最小限のルーター
3. **Worktop** - Workers 専用フレームワーク
4. **生の Fetch API** - フレームワークなし

### 決定

Hono を選択

### 理由

- **軽量性**: バンドルサイズが小さく、Workers 環境に最適
- **型安全性**: TypeScript 完全対応
- **機能性**: ミドルウェア、バリデーション、HTML レスポンス対応
- **開発体験**: Express.js ライクな API
- **コミュニティ**: 活発な開発とドキュメント

### 影響

- Express.js の知識が活用可能
- ミドルウェアによる機能拡張が容易
- 型安全なルーティングが実現

## ADR-003: エラーハンドリング戦略

### ステータス

承認済み

### コンテキスト

非同期処理とネットワーク通信を含むアプリケーションで、型安全で予測可能なエラーハンドリングが必要。

### 検討した選択肢

1. **neverthrow (Result 型)** - 関数型エラーハンドリング
2. **try-catch** - 従来の例外処理
3. **Promise.catch()** - Promise 基準のエラーハンドリング
4. **カスタムエラークラス** - 独自のエラー階層

### 決定

neverthrow の Result 型を選択

### 理由

- **型安全性**: エラーが型レベルで表現される
- **明示性**: 関数シグネチャでエラーの可能性が明確
- **合成可能性**: andThen、orElse による関数合成
- **予測可能性**: 例外による制御フローの中断がない

### 影響

- 学習コストが発生（関数型プログラミングの概念）
- すべての非同期処理で ResultAsync 型を使用
- エラーハンドリングが明示的になり、見落としが減少

## ADR-004: フロントエンドアーキテクチャ選択

### ステータス

承認済み

### コンテキスト

サーバーサイドレンダリング（SSR）環境で React ベースのコンポーネント開発を行い、保守性と開発効率を向上させる必要がある。

### 検討した選択肢

1. **React + Vite** - モダンな React 開発環境
2. **Vanilla JavaScript** - フレームワークなし
3. **Preact** - 軽量な React 代替
4. **Lit** - Web Components

### 決定

React + Vite を選択

### 理由

- **開発効率**: JSX/TSX によるコンポーネント開発
- **型安全性**: TypeScript との完全統合
- **エコシステム**: 豊富なライブラリとツール
- **SSR 対応**: Hono JSX との互換性
- **開発体験**: Hot Module Replacement、高速ビルド

### 影響

- バンドルサイズの増加（ただし Cloudflare Workers の制限内）
- React 開発者の知識が活用可能
- コンポーネントベースの設計が可能

## ADR-005: UI コンポーネントライブラリ選択

### ステータス

承認済み

### コンテキスト

React 環境でアクセシブルで美しい UI コンポーネントを効率的に構築するためのライブラリが必要。WCAG 2.2 準拠とカスタマイズ性が重要。

### 検討した選択肢

1. **shadcn/ui + TailwindCSS** - コピー&ペーストコンポーネント
2. **TailwindCSS + DaisyUI** - ユーティリティファースト + プリセット
3. **Chakra UI** - シンプルなコンポーネントライブラリ
4. **Mantine** - フル機能の UI ライブラリ

### 決定

shadcn/ui + TailwindCSS v4 を選択

### 理由

- **カスタマイズ性**: コンポーネントを直接編集可能
- **アクセシビリティ**: Radix UI ベースで高いアクセシビリティ
- **型安全性**: TypeScript 完全対応
- **バンドルサイズ**: 必要なコンポーネントのみ追加
- **保守性**: 外部依存を最小化、コードの完全制御
- **デザインシステム**: 一貫したデザイントークン
- **最新機能**: TailwindCSS v4 の新機能とパフォーマンス向上

### 影響

- 初期セットアップが必要
- コンポーネントの手動管理
- **TailwindCSS v4 の学習が必要**: v3 以前の書き方は使用せず、v4 の新しい記法を採用
- 高度なカスタマイズが可能
- **重要**: すべてのスタイリングは TailwindCSS v4 の記法で記述し、v3 以前の古い書き方は避ける

## ADR-006: 国際化アーキテクチャ

### ステータス

承認済み

### コンテキスト

日本語と英語の 2 言語対応が必要。サーバーサイドレンダリング環境での効率的な国際化実装が求められる。

### 検討した選択肢

1. **クライアントサイド国際化** - JavaScript による動的切り替え
2. **サーバーサイド国際化** - HTML レンダリング時に言語決定
3. **ハイブリッド方式** - 初期表示はサーバー、切り替えはクライアント
4. **静的ファイル生成** - 言語別の静的 HTML 生成

### 決定

ハイブリッド方式を選択

### 理由

- **初期表示速度**: サーバーサイドで言語決定、HTML に埋め込み
- **UX**: クライアントサイドでの即座な言語切り替え
- **SEO**: 初期 HTML に適切な言語コンテンツが含まれる
- **実装コスト**: 複雑すぎず、効果的

### 影響

- ローカルストレージによる言語設定保存
- JavaScript 無効環境でもデフォルト言語で動作
- 翻訳文字列の管理が必要

## ADR-007: フィード検索アルゴリズム

### ステータス

承認済み

### コンテキスト

効率的で網羅的なフィード検索を実現するアルゴリズムが必要。精度と性能のバランスが重要。

### 検討した選択肢

1. **HTML メタタグのみ** - RSS Autodiscovery 標準のみ
2. **パス検索のみ** - 一般的なフィードパスのみ
3. **並列検索** - メタタグとパス検索を同時実行
4. **段階的検索** - メタタグ優先、見つからない場合はパス検索

### 決定

段階的検索を選択

### 理由

- **効率性**: 不必要な HTTP リクエストを削減
- **精度**: 標準準拠のメタタグを優先
- **網羅性**: パス検索によるフォールバック
- **パフォーマンス**: 段階的実行により最適化

### 影響

- 検索方法の記録が必要（デバッグ用）
- 複雑な非同期フロー制御
- 重複フィードの除去処理が必要

## ADR-008: データ永続化戦略

### ステータス

承認済み

### コンテキスト

検索履歴とお気に入り機能のためのデータ永続化が必要。プライバシーとパフォーマンスを考慮。

### 検討した選択肢

1. **ローカルストレージ** - ブラウザローカル保存
2. **Cloudflare KV** - エッジストレージ
3. **Cloudflare D1** - SQLite データベース
4. **外部データベース** - PostgreSQL 等

### 決定

ローカルストレージを選択（第一段階）

### 理由

- **プライバシー**: データがユーザーのブラウザに保存
- **パフォーマンス**: ネットワーク通信不要
- **実装コスト**: 追加インフラ不要
- **段階的実装**: 将来的にクラウドストレージに移行可能

### 影響

- デバイス間でのデータ同期不可
- ブラウザデータ削除でデータ消失
- ストレージ容量制限あり

## ADR-010: TailwindCSS バージョン戦略

### ステータス

承認済み

### コンテキスト

TailwindCSS のバージョン選択において、最新の機能とパフォーマンス向上を活用する必要がある。v4 では大幅な改善が行われており、従来の v3 以前とは記法が異なる。

### 検討した選択肢

1. **TailwindCSS v3** - 安定版、豊富なドキュメント
2. **TailwindCSS v4** - 最新版、パフォーマンス向上
3. **TailwindCSS v2** - 旧安定版
4. **カスタム CSS** - TailwindCSS 不使用

### 決定

TailwindCSS v4 を選択

### 理由

- **パフォーマンス**: v4 での大幅な高速化
- **新機能**: 改善された DX（開発者体験）
- **将来性**: 長期的なサポートとアップデート
- **モダンな記法**: より直感的で効率的な書き方
- **バンドルサイズ**: さらなる最適化

### 影響

- **重要制約**: v3 以前の記法は使用禁止、すべて v4 記法で統一
- 学習コストの発生（v3 からの移行）
- ドキュメントが v4 準拠である必要
- 開発チーム全体での v4 記法の習得が必要

## ADR-011: CI/CD パイプライン戦略

### ステータス

承認済み

### コンテキスト

継続的インテグレーション・継続的デプロイメント（CI/CD）により、コード品質の維持と効率的なデプロイメントを実現する必要がある。Cloudflare Workers 環境での最適な CI/CD 戦略を選択する必要がある。

### 検討した選択肢

1. **GitHub Actions** - GitHub 統合、豊富なエコシステム
2. **GitLab CI/CD** - 統合された DevOps プラットフォーム
3. **Cloudflare Workers CI/CD** - Cloudflare 専用ツール
4. **手動デプロイ** - CI/CD なし

### 決定

GitHub Actions を選択

### 理由

- **統合性**: GitHub リポジトリとの完全統合
- **エコシステム**: 豊富な Actions マーケットプレイス
- **コスト**: パブリックリポジトリでは無料
- **Cloudflare 対応**: wrangler との優れた統合
- **柔軟性**: カスタムワークフローの作成が容易

### 影響

- GitHub リポジトリが必要
- .github/workflows/ ディレクトリでの設定管理
- GitHub Secrets での機密情報管理（手動デプロイ時のみ使用）
- **実装変更**: 自動デプロイは無効化し、セキュリティ重視の手動デプロイを採用

## ADR-012: Git フック戦略

### ステータス

承認済み

### コンテキスト

コミット前とプッシュ前にコード品質チェックを自動実行し、問題のあるコードがリポジトリに入ることを防ぐ必要がある。開発者の生産性を損なわない効率的なフック戦略が必要。

### 検討した選択肢

1. **lefthook** - 高速で設定が簡単
2. **husky** - Node.js エコシステムで人気
3. **pre-commit** - Python ベースのツール
4. **手動チェック** - フックなし

### 決定

lefthook を選択

### 理由

- **パフォーマンス**: Go 製で高速実行
- **設定の簡潔性**: YAML ベースの直感的な設定
- **並列実行**: 複数チェックの同時実行
- **クロスプラットフォーム**: 各 OS での安定動作
- **軽量**: 依存関係が少ない

### 影響

- lefthook.yml での設定管理
- pre-commit と pre-push フックの自動実行
- staged_files と push_files の効率的な処理
- 開発者の初回セットアップが必要
- **実装改善**: 
  - TypeScript型チェック（tsc --noEmit）の追加
  - npm auditによる依存関係脆弱性チェック
  - pre-pushの高速化（4.89秒→0.41秒、92%改善）

## ADR-013: テスト駆動開発（TDD）戦略

### ステータス

承認済み

### コンテキスト

Agentic coding（AI エージェントによるコード生成）環境において、t-wada 氏が提唱する TDD 手法を適用し、高品質で保守性の高いコードを効率的に生成する必要がある。AI エージェントが理解しやすく、実行しやすい TDD プロセスを確立する必要がある。

### 検討した選択肢

1. **t-wada 式 TDD** - Red-Green-Refactor サイクルの厳格な適用
2. **従来の TDD** - 一般的なテストファースト開発
3. **テスト後書き** - 実装後のテスト作成
4. **テストなし** - テストを書かない開発

### 決定

t-wada 式 TDD を Agentic coding 向けに最適化して採用

### 理由

- **明確なプロセス**: AI エージェントが従いやすい明確な手順
- **品質保証**: テストファーストによる高品質なコード
- **リファクタリング安全性**: テストによる変更の安全性確保
- **仕様の明確化**: テストが仕様書として機能
- **デバッグ効率**: 問題の早期発見と修正

### 影響

- **厳格な Red-Green-Refactor サイクル**: 各ステップを明確に分離
- **テストファースト**: 実装前に必ずテストを作成
- **小さなステップ**: 一度に一つの機能のみ実装
- **継続的リファクタリング**: Green 後の必須リファクタリング

### Agentic Coding 向け最適化

#### 1. テスト作成フェーズ（Red）

```typescript
// 1. 失敗するテストを最初に作成
describe("normalizeUrl", () => {
  it("should add https protocol to URL without protocol", () => {
    const result = normalizeUrl("example.com");
    expect(result.isOk()).toBe(true);
    expect(result.value).toBe("https://example.com");
  });
});
```

#### 2. 最小実装フェーズ（Green）

```typescript
// 2. テストを通すための最小限の実装
function normalizeUrl(url: string): Result<string, FeedSearchError> {
  if (!url.startsWith("http")) {
    return ok(`https://${url}`);
  }
  return ok(url);
}
```

#### 3. リファクタリングフェーズ（Refactor）

```typescript
// 3. コードの改善（テストは変更しない）
function normalizeUrl(url: string): Result<string, FeedSearchError> {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return ok(parsed.toString());
  } catch {
    return err({ type: "invalid-url", message: "Invalid URL format" });
  }
}
```

## ADR-014: アクセシビリティ実装方針

### ステータス

承認済み

### コンテキスト

WCAG 2.2 AA 準拠のアクセシブルな Web アプリケーションを構築する必要がある。

### 検討した選択肢

1. **セマンティック HTML + ARIA** - 標準的なアプローチ
2. **アクセシビリティライブラリ** - 専用ライブラリ使用
3. **後付け対応** - 基本機能完成後に対応
4. **最小限対応** - 基本的な対応のみ

### 決定

セマンティック HTML + ARIA を選択

### 理由

- **標準準拠**: Web 標準に基づく実装
- **保守性**: 追加ライブラリへの依存なし
- **パフォーマンス**: 軽量な実装
- **将来性**: 標準の進化に追従可能

### 影響

- HTML 構造の慎重な設計が必要
- ARIA ラベルの適切な実装
- キーボードナビゲーションの実装
- 色覚異常対応の配色設計
- **WCAG 2.2 追加要件**:
  - フォーカス時の要素が他の UI 要素で隠れないよう設計
  - タッチターゲット（ボタン、リンク）の最小サイズを 24×24px 以上に設定
  - ドラッグ操作がある場合は代替手段を提供（現在は該当なし）

## システムアーキテクチャ

### 全体構成図

```mermaid
graph TB
    User[ユーザー] --> Browser[ブラウザ]
    Browser --> CDN[Cloudflare CDN]
    CDN --> Workers[Cloudflare Workers]
    Workers --> External[外部サイト]

    subgraph "ブラウザ環境"
        React[React App]
        LocalStorage[ローカルストレージ]
        I18nClient[クライアント国際化]

        subgraph "React コンポーネント"
            SearchForm[検索フォーム]
            ResultDisplay[結果表示]
            LanguageToggle[言語切替]
            FeedCard[フィードカード]
        end

        subgraph "shadcn/ui + TailwindCSS"
            Button[Button]
            Input[Input]
            Card[Card]
            Alert[Alert]
        end
    end

    subgraph "Cloudflare Workers (SSR)"
        Hono[Hono Framework]
        ReactSSR[React SSR]
        Search[フィード検索エンジン]
        I18nServer[サーバー国際化]

        subgraph "検索エンジン"
            URLNormalizer[URL正規化]
            HTMLParser[HTMLパーサー]
            PathSearcher[パス検索]
            ResultAggregator[結果集約]
        end
    end

    Browser --> React
    React --> SearchForm
    React --> ResultDisplay
    React --> LanguageToggle
    React --> LocalStorage
    React --> I18nClient

    SearchForm --> Button
    SearchForm --> Input
    ResultDisplay --> Card
    ResultDisplay --> Alert

    Workers --> Hono
    Hono --> ReactSSR
    Hono --> Search
    Hono --> I18nServer

    Search --> URLNormalizer
    Search --> HTMLParser
    Search --> PathSearcher
    Search --> ResultAggregator
```

### データフロー図

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant RC as React Client
    participant LS as LocalStorage
    participant W as Workers (SSR)
    participant SE as Workers検索エンジン
    participant E as 外部サイト

    Note over U,E: 初期ページロード
    U->>W: GET /
    W->>W: サーバー国際化処理
    W->>RC: React SSR (初期HTML)
    RC->>U: ページ表示

    Note over U,E: クライアント初期化
    RC->>LS: 言語設定読み込み
    LS->>RC: 保存済み設定
    RC->>RC: クライアント国際化初期化

    Note over U,E: フィード検索フロー
    U->>RC: URL入力
    RC->>LS: 検索履歴保存
    RC->>W: POST /api/search
    W->>SE: Workers内フィード検索開始

    SE->>SE: URL正規化
    SE->>E: HTML取得リクエスト
    E->>SE: HTMLレスポンス
    SE->>SE: メタタグ解析

    alt メタタグでフィード発見
        SE->>W: 検索結果
    else メタタグで未発見
        SE->>E: 一般的パス検索
        E->>SE: パス存在確認
        SE->>W: 検索結果
    end

    W->>RC: JSON API レスポンス
    RC->>RC: 結果表示更新
    RC->>U: 検索結果表示

    Note over U,E: お気に入り機能
    U->>RC: お気に入り追加
    RC->>LS: フィード情報保存

    Note over U,E: 言語切替
    U->>RC: 言語切替ボタン
    RC->>LS: 言語設定保存
    RC->>RC: UI言語更新
    RC->>U: 言語変更反映
```

## コンポーネント設計

### 1. フィード検索エンジン

```typescript
interface FeedSearchEngine {
  searchFeeds(url: string): ResultAsync<SearchResult, FeedSearchError>;
  normalizeUrl(url: string): Result<string, FeedSearchError>;
  extractFromHtml(html: string, baseUrl: string): FeedResult[];
  searchCommonPaths(
    baseUrl: string
  ): ResultAsync<FeedResult[], FeedSearchError>;
}
```

### 2. 国際化システム

```typescript
interface I18nSystem {
  getCurrentLanguage(): Language;
  setLanguage(lang: Language): void;
  translate(key: string, params?: Record<string, string>): string;
  getMessages(lang: Language): Messages;
}
```

### 3. ストレージマネージャー

```typescript
interface StorageManager {
  saveSearchHistory(url: string): void;
  getSearchHistory(): string[];
  saveFavorite(feed: FeedResult): void;
  getFavorites(): FeedResult[];
  clearHistory(): void;
}
```

### 4. UI コンポーネント

```typescript
// React コンポーネント
interface SearchFormProps {
  currentUrl?: string;
  onSubmit: (url: string) => void;
}

interface ResultsProps {
  result: SearchResult;
  language: Language;
}

interface ErrorDisplayProps {
  error: FeedSearchError;
  language: Language;
}

interface LanguageToggleProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
}
```

## セキュリティ設計

### XSS 対策

- すべてのユーザー入力を HTML エスケープ
- Content Security Policy (CSP) の実装
- SRI (Subresource Integrity) による外部リソース検証

### プライバシー保護

- ローカルストレージによるデータ保存
- 外部への不要なデータ送信なし
- ユーザー追跡の回避

### ネットワークセキュリティ

- HTTPS 強制
- 適切な User-Agent の設定
- レート制限の実装（将来）

## パフォーマンス設計

### 最適化戦略

- HEAD リクエストによる効率的な存在確認
- 段階的検索による不要リクエスト削減
- CDN による静的リソース配信
- エッジコンピューティングによる低レイテンシ
- **非同期処理の積極活用**: 複数のフィードパス検索、外部サイトへのリクエストなど、並列実行可能な処理は積極的に非同期化してスケーラビリティを確保
- **Promise.all()による並列処理**: 独立した複数の HTTP リクエストを同時実行
- **ResultAsync 合成**: neverthrow ライブラリを活用した非同期エラーハンドリングの最適化

### 監視指標

- 検索レスポンス時間
- フィード発見率
- エラー発生率
- ユーザー満足度

## ADR-015: CI/CDパフォーマンス最適化戦略

### ステータス

承認済み

### コンテキスト

Git フックの実行時間が開発者体験に大きく影響するため、CI/CDパイプラインの高速化が必要。特にpre-pushフックが4.89秒と長く、開発効率を損ねていた。

### 検討した選択肢

1. **全ファイルチェック** - 確実だが遅い
2. **変更ファイルのみチェック** - 高速だがリスクあり
3. **段階的チェック** - pre-commitで基本、pre-pushで最小限
4. **並列実行** - 複数タスクの同時実行

### 決定

段階的チェック + ファイル絞り込み戦略を選択

### 理由

- **開発者体験**: 4.89秒 → 0.41秒（92%改善）
- **品質維持**: 重要なチェックは保持
- **効率性**: srcフォルダのみに絞り込み
- **実用性**: 日常的な使用で耐えられる速度

### 影響

- pre-pushの対象をsrcフォルダに限定
- 自動生成ファイル（*.d.ts）の除外
- Biome設定の最適化
- GitHub Actionsでの包括的チェック

## 拡張性設計

### 将来の拡張ポイント

1. **認証システム**: ユーザーアカウント機能
2. **クラウドストレージ**: デバイス間同期
3. **API 提供**: 外部サービス連携
4. **バッチ処理**: 大量 URL 処理
5. **フィード分析**: 詳細情報提供

### アーキテクチャ進化

- マイクロサービス化の可能性
- GraphQL API の導入
- リアルタイム機能の追加
- 機械学習による精度向上
