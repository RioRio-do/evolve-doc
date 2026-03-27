# EvolveDoc

**EvolveDoc** は、**複数の LLM バックエンド**（Claude Agent SDK、OpenAI Codex SDK、または OpenAI / Ollama / Groq などの **OpenAI 互換 HTTP API**）に同じ進化中のコンテキストを順に渡し、**ドキュメントを反復的に改善**するための軽量 TypeScript フレームワークです。

**個人向け・低摩擦**の利用を想定しています。仕様書や README をファイルとして保持し、**プラン**でステップを定義し、各ステップで使うアダプターを選びます。

英語版は [README.md](./README.md) を参照してください。

---

## 目次

1. [EvolveDoc が解くこと](#evolvedoc-が解くこと)
2. [動作の仕組み](#動作の仕組み)
3. [アーキテクチャ](#アーキテクチャ)
4. [要件](#要件)
5. [インストール](#インストール)
6. [設定: `evolvedoc.config.json`](#設定-evolvedocconfigjson)
7. [進化プラン: `*.plan.json`](#進化プラン-planjson)
8. [CLI の実行](#cli-の実行)
9. [ライブラリとしての利用](#ライブラリとしての利用)
10. [セキュリティと認証情報](#セキュリティと認証情報)
11. [制限事項](#制限事項)
12. [開発](#開発)
13. [関連ドキュメント](#関連ドキュメント)

---

## EvolveDoc が解くこと

想定ユースケースの例:

| ユースケース | 内容 |
|--------------|------|
| **仕様レビュー** | あるモデルが矛盾を列挙し、別モデルが章を書き直す。 |
| **ドキュメント補完** | README を種にし、別モデルが不足箇所を埋める。 |
| **多段ポリッシュ** | 同一文書を複数モデルに順番に通す。 |
| **クロスモデル整合** | 一方が草案、他方が内部整合性を検証。 |

EvolveDoc は **Web UI やマルチテナントサービスを提供しません**。**ローカル**で動かし、公式 SDK または HTTP API 経由で各プロバイダーに接続します。

---

## 動作の仕組み

### ドキュメント注入プロトコル（DIP）

モデルは通常、**`assistant` ターン**を「自分の過去の出力」として扱います。EvolveDoc は外部ファイルを **`assistant` メッセージ**として注入し、その前に任意の **`user` トリガー**を置きます。これにより **所有権の錯覚**が生じ、後続の指示が安定しやすくなります。

コード内のデフォルトトリガー文は日本語です。言語を合わせるにはプランの `triggerPrompt` で上書きしてください。

### モデルスイッチ

注入後、各 **ステップ**で **user** を追加 → アダプター実行 → **assistant** を履歴に追加します。次のアダプターには **同じ履歴全体**が渡るため、注入文書を「過去のアシスタント出力」として引き継げます。

### 進化ループ

1. 入力ファイルを読み込む（`.md` は `gray-matter` で frontmatter を除いた本文を使用）。
2. 初期メッセージ列を構築（トリガー user → 注入 assistant）。
3. 各ステップでアダプターを解決 → 実行 → assistant を追記。
4. **最後の assistant 出力**を `outputFile` に保存。
5. `saveIntermediates` が true なら、`outputFile.<outputKey>.md` にも中間出力を保存。

---

## アーキテクチャ

| コンポーネント | 役割 |
|----------------|------|
| **DocumentLoader** | ファイル読み込み、Markdown の正規化 |
| **InjectionEngine** | DIP に基づく初期 `Message[]` の構築 |
| **EvolutionRunner** | ステップ実行と出力保存 |
| **AdapterRegistry** | プランで参照される **adapterId だけ**を遅延生成（未使用エントリは API キー不要） |
| **アダプター** | `claude-agent` / `codex-sdk` / `openai-compat` — いずれも `LLMAdapter` を実装 |

設計の一次情報: [spec.md](./spec.md)。依存・SDK の調査: [RESEARCH.md](./RESEARCH.md)。

---

## 要件

- **[Bun](https://bun.sh)** 1.x（パッケージマネージャ兼実行環境。ロックファイルは `bun.lock`）

下層の SDK は **Node.js 18+** 前提です。Bun 上では Node 互換レイヤーを利用します。

---

## インストール

リポジトリをクローンまたはコピーしたうえで、プロジェクトルートで:

```bash
bun install
```

---

## 設定: `evolvedoc.config.json`

プロジェクト直下などに JSON を置きます（CLI のデフォルトファイル名は **`evolvedoc.config.json`**）。トップレベルに **`adapters`** オブジェクトがあり、キーがプランから参照する **アダプター ID**、値が `"type"` で区別される設定です。

テンプレートをコピーして編集します。

```bash
cp evolvedoc.config.example.json evolvedoc.config.json
```

### アダプター種別

#### `claude-agent`（Anthropic Claude Agent SDK）

Claude Agent SDK の `query` で実行。例:

```json
{
  "type": "claude-agent",
  "defaultModel": "claude-sonnet-4-20250514",
  "allowedTools": []
}
```

**`allowedTools`: `[]`** でツールを使わないテキスト寄りの動作にできます。Anthropic の SDK に従い、Claude Code / API などの認証が必要です。

#### `codex-sdk`（OpenAI Codex SDK）

```json
{
  "type": "codex-sdk",
  "defaultModel": "gpt-5.4",
  "persistThread": false,
  "skipGitRepoCheck": true
}
```

- **`skipGitRepoCheck`**: 作業ディレクトリが **Git 管理でない**場合に `true`（Codex は Git 前提のことが多い）。
- **`persistThread`**: `true` のとき、同一プロセス内のステップで Codex スレッド ID を再利用。

#### `openai-compat`（OpenAI 互換 Chat Completions）

OpenAI 本番や、**`/v1/chat/completions`** 互換のローカル・他社 API に接続:

```json
{
  "type": "openai-compat",
  "apiKeyEnvVar": "OPENAI_API_KEY",
  "defaultModel": "gpt-4.1"
}
```

Ollama 等の例:

```json
{
  "type": "openai-compat",
  "baseUrl": "http://localhost:11434/v1",
  "apiKeyEnvVar": "OLLAMA_API_KEY",
  "defaultModel": "llama3.3"
}
```

参照する環境変数を実行前に設定するか、JSON に `apiKey` を直接書く方法もあります（**コミットしないこと**）。

---

## 進化プラン: `*.plan.json`

プランは **1 つの入力ファイル**、**1 つの最終出力パス**、任意の **トリガー**、順序付き **ステップ**を定義します。

| フィールド | 意味 |
|------------|------|
| `name` | ログ用の論理名 |
| `inputFile` | 注入するドキュメントのパス（**カレントディレクトリ**からの相対パスとして解決） |
| `outputFile` | 最終出力のパス |
| `triggerPrompt` | 任意。注入前 user メッセージを上書き |
| `saveIntermediates` | `true` のとき、`outputKey` 付きステップごとに `outputFile.<outputKey>.md` を保存 |
| `steps` | `{ adapterId, prompt, model?, outputKey? }` の配列 |

**`adapterId`** は `evolvedoc.config.json` の `adapters` のキーと一致させます。

例（`docs/examples/example.plan.json`）:

```json
{
  "name": "spec-review",
  "inputFile": "./docs/examples/sample-input.md",
  "outputFile": "./docs/examples/sample-output.md",
  "triggerPrompt": "以下の仕様書ドキュメントを作成しました。これをベースに作業を続けます。",
  "saveIntermediates": false,
  "steps": [
    {
      "adapterId": "openai",
      "prompt": "この文書を簡潔に要約してください。"
    }
  ]
}
```

---

## CLI の実行

エントリは **`evolvedoc`**、サブコマンドは **`run`**。

```bash
bun run src/cli/index.ts run <プラン.json> [--config <設定.json>]
```

- **`--config` / `-c`**: アダプター設定ファイル。**既定値:** カレントディレクトリの **`evolvedoc.config.json`**。
- プラン内のパスは **プロセスのカレントディレクトリ**基準で解決されます（設定ファイルの場所ではありません）。

付属の実行ファイル:

```bash
chmod +x ./bin/evolvedoc
./bin/evolvedoc run ./docs/examples/example.plan.json -c ./evolvedoc.config.json
```

実行前に、各プロバイダーが要求する **API キーまたは CLI ログイン**を済ませてください。プランで **参照されるアダプターだけ**がインスタンス化されます。

---

## ライブラリとしての利用

`src/index.ts` から Zod 検証付きの設定・プランローダー、`runEvolution`、`buildRegistryFromConfig` などをインポートして、コード上でプランを組み立てることもできます。

```typescript
import {
  loadEvolvedocConfig,
  loadEvolutionPlan,
  buildRegistryFromConfig,
  runEvolution,
} from "evolve-doc";

const config = await loadEvolvedocConfig("./evolvedoc.config.json");
const plan = await loadEvolutionPlan("./my.plan.json");
const registry = buildRegistryFromConfig(config.adapters);
await runEvolution(plan, registry);
await registry.disposeAll();
```

リポジトリ内で直接試す場合は、`"evolve-doc"` の代わりに `./src/index.ts` など相対パスを使ってください。

---

## セキュリティと認証情報

- 秘密情報は **`apiKeyEnvVar` と環境変数**を優先し、JSON への直書きは避ける。
- **注入する文書**は信頼できる前提。悪意のある内容はプロンプトインジェクションのリスクがある。
- Claude Agent の **`allowedTools`** は必要最小限に。
- 本フレームワークは **個人利用**を想定し、マルチユーザー向けホスティングは対象外。

詳細は [spec.md](./spec.md) のセキュリティ節を参照。

---

## 制限事項

- **v1.0** ではステップは **逐次実行のみ**（並列進化なし）。
- **フレームワーク単体**は CLI 実行間でセッションを永続化しない。続きからやり直す場合は、最終出力を `inputFile` にするなど運用で補う。
- 各プロバイダーの制約（CLI ログイン、Codex の Git 前提、コンテキスト長など）はそのドキュメントに従う。

---

## 開発

```bash
bun run typecheck   # TypeScript
bun run test        # Vitest
```

---

## 関連ドキュメント

| ドキュメント | 内容 |
|--------------|------|
| [spec.md](./spec.md) | 正式仕様書（v1.0.0） |
| [RESEARCH.md](./RESEARCH.md) | SDK バージョン、Bun、実装メモ |

---

## ライセンス

本プロジェクトの仕様・コードは現状のまま提供されます。サードパーティパッケージは各ライセンスに従います。
