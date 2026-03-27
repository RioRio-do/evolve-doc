# EvolveDoc 仕様書

**バージョン**: 1.0.0  
**作成日**: 2026-03-27  
**最終更新**: 2026-03-27  
**ステータス**: Released

### 変更履歴

| バージョン | 内容 |
|---|---|
| 1.0.0 | 初版リリース。Bun 採用、依存（Zod 4、各 SDK）の確定、Claude/Codex SDK の公式 API に沿った仕様文言への修正。 |

---

## 目次

1. [概要](#概要)
2. [コアコンセプト](#コアコンセプト)
3. [システムアーキテクチャ](#システムアーキテクチャ)
4. [技術選定](#技術選定)
5. [アダプター仕様](#アダプター仕様)
6. [ドキュメント注入プロトコル（DIP）](#ドキュメント注入プロトコルdip)
7. [エージェントループ仕様](#エージェントループ仕様)
8. [設定仕様](#設定仕様)
9. [ディレクトリ構成](#ディレクトリ構成)
10. [セキュリティ考慮事項](#セキュリティ考慮事項)
11. [制約・既知の制限](#制約既知の制限)

---

## 概要

EvolveDoc は、外部で作成した仕様書を AI 自身が出力したものだと認識させた上で、対話相手を異なる LLM モデルへ切り替えることにより、ドキュメントを自律的に進化させる軽量フレームワークである。

### 目的

- 複数の LLM の視点・能力を掛け合わせた仕様書の自動改善
- 人間が書いた初期ドキュメントを AI の「記憶」として注入し、継続的な進化ループを実現
- 個人利用を前提とした低コスト・低設定での運用

### 想定ユースケース

| ユースケース | 説明 |
|---|---|
| 仕様書レビュー | Claude で書いた仕様書を Codex に渡し、技術的矛盾を指摘させる |
| ドキュメント補完 | 既存の README をベースに、別モデルが不足セクションを追記する |
| 多視点リファクタリング | 同じ文書を複数モデルが順番にレビューし、品質を段階的に高める |
| クロスモデル整合検証 | あるモデルが生成した仕様を別モデルが検証し、矛盾を検出する |

---

## コアコンセプト

### ドキュメント注入（Document Injection）

EvolveDoc の中心原理は「**文書の所有権の錯覚（Ownership Illusion）**」である。

通常、AI への入力はユーザーターンとして渡される。しかしモデルが自分自身の過去の出力として認識するのは `assistant` ターンである。EvolveDoc はこの性質を利用し、外部文書を `assistant` ロールのメッセージとして会話履歴に注入することで、AI に「自分がこのドキュメントを書いた」と認識させる。

```
通常の会話:
  user   → "仕様書を書いて"
  assistant → "# 仕様書 ..."   ← モデルが生成

EvolveDoc の注入:
  user      → [注入トリガープロンプト]
  assistant → [外部ファイルの内容]  ← 外部文書をここに差し込む
  user      → "この仕様書をレビューして改善点を提案してください"
```

### モデルスイッチング（Model Switching）

注入後、会話コンテキストを別の LLM アダプターへ渡すことで、異なるモデルが同一文書を「自分の過去の出力」として引き継ぎ、処理を続行する。

```
[Claude Agent SDK]       [Codex SDK]          [OpenAI 互換 API]
     ↓                       ↓                      ↓
  初期レビュー    →    技術的検証     →     最終ポリッシュ
  (assistant注入)    (コンテキスト引継)   (コンテキスト引継)
```

### 進化ループ（Evolution Loop）

```
外部文書
   ↓
[注入] → assistant ロールとして配置
   ↓
[LLM A が処理] → 改善案を生成
   ↓
[モデルスイッチ] → コンテキストを LLM B へ引き渡し
   ↓
[LLM B が処理] → さらに改善
   ↓
[出力保存] → 進化後ドキュメントをファイルに書き出し
   ↓
[ループ継続 or 終了]
```

---

## システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                     EvolveDoc Core                      │
│                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ Document │   │  Injection   │   │  Evolution     │  │
│  │  Loader  │──▶│   Engine     │──▶│    Runner      │  │
│  └──────────┘   └──────────────┘   └───────┬────────┘  │
│                                            │           │
│                              ┌─────────────▼──────┐    │
│                              │  Adapter Registry  │    │
│                              └─────────────┬──────┘    │
│                                            │           │
│              ┌──────────────┬──────────────┴──────┐    │
│              ▼              ▼                      ▼    │
│  ┌──────────────┐ ┌──────────────┐  ┌─────────────────┐│
│  │ ClaudeAgent  │ │  CodexSDK    │  │  OpenAICompat   ││
│  │   Adapter    │ │   Adapter    │  │    Adapter      ││
│  └──────────────┘ └──────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 主要コンポーネント

| コンポーネント | 役割 |
|---|---|
| `DocumentLoader` | ファイル読み込み・正規化（Markdown は frontmatter 除去、JSON は parse 後に整形文字列化、その他は生テキスト） |
| `InjectionEngine` | `assistant` ロールへの文書注入・会話履歴の構築 |
| `EvolutionRunner` | エージェントループの実行・ステップ管理・出力収集 |
| `AdapterRegistry` | アダプターの登録・解決・切り替え |
| `ClaudeAgentAdapter` | Claude Agent SDK ラッパー |
| `CodexSDKAdapter` | Codex SDK ラッパー |
| `OpenAICompatAdapter` | OpenAI 互換 API ラッパー |

---

## 技術選定

### 言語・ランタイム

| 項目 | 選定 | 理由 |
|---|---|---|
| 言語 | TypeScript | 各アダプターが TypeScript 向けに提供されており、型安全性による保守性向上 |
| ランタイム | **Bun** | パッケージ管理と実行を統一。Claude / Codex SDK は Node.js 18+ 前提のため、Bun の Node API 互換レイヤーを利用する |
| パッケージマネージャ | **Bun** | `bun install` / `bun run` / `bunx`。ロックファイル `bun.lock` で再現性を確保 |

### 依存ライブラリ

```jsonc
{
  "dependencies": {
    // アダプター（バージョンは RESEARCH.md・bun.lock と一致させる）
    "@anthropic-ai/claude-agent-sdk": "^0.2.85", // peer: zod ^4
    "@openai/codex-sdk": "^0.117.0",              // Codex SDK
    "openai": "^6.x",                             // OpenAI 互換 API クライアント

    // ユーティリティ
    "zod": "^4.x",          // 設定スキーマ（Claude Agent SDK の peer と整合）
    "gray-matter": "^4.x",  // Markdown frontmatter パース
    "chalk": "^5.x",        // CLI 出力整形
    "commander": "^14.x"    // CLI インターフェース
  },
  "devDependencies": {
    "typescript": "^6.x",
    "@types/node": "^25.x",
    "vitest": "^4.x"        // テストフレームワーク
  }
}
```

---

## アダプター仕様

すべてのアダプターは共通インターフェース `LLMAdapter` を実装する。

### 共通インターフェース

```typescript
// src/adapters/types.ts

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface RunOptions {
  messages: Message[];       // 注入済みの会話履歴
  systemPrompt?: string;     // システムプロンプト（任意）
  maxTokens?: number;        // 最大出力トークン数
  maxAgentTurns?: number;    // Claude Agent SDK のみ: `maxTurns`（エージェントループ上限）。他アダプターでは無視
  model?: string;            // モデル名（アダプター既定値を上書き）
}

export interface RunResult {
  content: string;           // LLM の出力テキスト
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface LLMAdapter {
  readonly name: string;     // アダプター識別子
  run(options: RunOptions): Promise<RunResult>;
  dispose?(): Promise<void>; // リソース解放（任意）
}
```

---

### ClaudeAgentAdapter

**パッケージ**: `@anthropic-ai/claude-agent-sdk` v0.2.85+  
**認証**: Claude Code CLI 経由のサブスクリプション（Pro / Max）または `ANTHROPIC_API_KEY`

#### 仕様

TypeScript の Claude Agent SDK は **公式ドキュメントどおり** `query({ prompt, options })` に渡す **プレーンオブジェクト**を用いる（Python の `ClaudeAgentOptions(...)` コンストラクタとは異なる）。ストリーム上のメッセージは `message.type` / `"result" in message` 等で判別し、最終テキストを結合する。

```typescript
// src/adapters/claude-agent.adapter.ts

import { query } from "@anthropic-ai/claude-agent-sdk";

export class ClaudeAgentAdapter implements LLMAdapter {
  readonly name = "claude-agent";

  constructor(private config: ClaudeAgentAdapterConfig) {}

  async run(options: RunOptions): Promise<RunResult> {
    // 会話履歴を単一プロンプト文字列へシリアライズして注入
    const serializedHistory = serializeMessages(options.messages);

    const chunks: string[] = [];
    for await (const message of query({
      prompt: serializedHistory,
      options: {
        systemPrompt: options.systemPrompt,
        model: options.model ?? this.config.defaultModel,
        allowedTools: this.config.allowedTools ?? [],
        permissionMode: "acceptEdits",
      },
    })) {
      if ("result" in message && message.result) {
        chunks.push(String(message.result));
      }
    }

    return { content: chunks.join("") };
  }
}

export interface ClaudeAgentAdapterConfig {
  defaultModel?: string;       // 例: "claude-sonnet-4-6"
  allowedTools?: string[];     // 例: ["Read", "WebSearch"]
  cliPath?: string;            // Claude Code 実行ファイルパス（SDK の pathToClaudeCodeExecutable にマップ）
}
```

#### 注意事項

- `cliPath` は実装で SDK の **`pathToClaudeCodeExecutable`** に渡される
- Claude Agent SDK は内部で Claude Code CLI プロセスを spawn するため、`claude` コマンドが PATH に存在する必要がある（`cliPath` 指定時はそのパスを使用）
- サブスクリプション利用時は、事前に `claude` コマンドでログイン済みであること
- `allowedTools` を空配列にすると、ファイルシステムアクセスなし（テキスト専用）のモードで動作する
- **Zod 4**: パッケージに `zod ^4` の peer があるため、プロジェクトの `zod` は 4.x とする

---

### CodexSDKAdapter

**パッケージ**: `@openai/codex-sdk`  
**認証**: Codex CLI 経由のサブスクリプション（ChatGPT Plus / Pro）または `OPENAI_API_KEY`

#### 仕様

公式スレッド API は **`startThread()`** で新規、**`resumeThread(threadId)`** で再開する。`persistThread` が true のときは、前回の `thread.id` を保存し、次回 `resumeThread(this.threadId)` から `run` する。

```typescript
// src/adapters/codex-sdk.adapter.ts

import { Codex, type ThreadOptions } from "@openai/codex-sdk";

export class CodexSDKAdapter implements LLMAdapter {
  readonly name = "codex-sdk";
  private codex: Codex;
  private threadId?: string;

  constructor(private config: CodexSDKAdapterConfig) {
    this.codex = new Codex({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  }

  private threadOptions(modelOverride?: string): ThreadOptions {
    return {
      model: modelOverride ?? this.config.defaultModel,
      skipGitRepoCheck: this.config.skipGitRepoCheck,
    };
  }

  async run(options: RunOptions): Promise<RunResult> {
    const model = options.model ?? this.config.defaultModel;
    const tOpts = this.threadOptions(model);

    const thread =
      this.config.persistThread && this.threadId
        ? this.codex.resumeThread(this.threadId, tOpts)
        : this.codex.startThread(tOpts);

    // 実装では `serializeMessages` と任意の `systemPrompt` 前置きに相当
    const prompt = buildCodexPrompt(options.messages, options.systemPrompt);
    const result = await thread.run(prompt);

    if (this.config.persistThread && thread.id) {
      this.threadId = thread.id;
    }

    return { content: result.finalResponse ?? "" };
  }

  async dispose(): Promise<void> {
    this.threadId = undefined;
  }
}

export interface CodexSDKAdapterConfig {
  apiKey?: string;           // 未設定時: 環境変数 OPENAI_API_KEY またはサブスクリプション
  baseUrl?: string;          // カスタムエンドポイント（任意）
  defaultModel?: string;     // 例: "gpt-5.4"、"gpt-5.3-codex"
  persistThread?: boolean;   // スレッドを使い回すか否か（デフォルト: false）
  skipGitRepoCheck?: boolean; // 非 Git ディレクトリで実行する場合に true
}
```

#### 注意事項

- サブスクリプション利用時は、事前に `codex` コマンドでログイン済みであること（`codex logout` → `codex` で切り替え可能）
- Codex SDK はスレッドを `~/.codex/sessions` に保存する。`persistThread: true` のとき **`dispose()`** でメモリ上のスレッド ID は解放するが、**ディスク上のセッションファイルの削除は公開 SDK に API がない**ため行わない（必要なら手動で `~/.codex/sessions` を保守する）
- デフォルトモデルは `gpt-5.4`（現行の推奨モデル）

---

### OpenAICompatAdapter

**パッケージ**: `openai` v6.x  
**認証**: API キー（`OPENAI_API_KEY` 等の環境変数、または設定ファイル）

OpenAI Chat Completions API と互換性のあるエンドポイントを持つプロバイダーすべてに対応する汎用アダプター。

#### 仕様

```typescript
// src/adapters/openai-compat.adapter.ts

import OpenAI from "openai";

export class OpenAICompatAdapter implements LLMAdapter {
  readonly name = "openai-compat";
  private client: OpenAI;

  constructor(private config: OpenAICompatAdapterConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env[config.apiKeyEnvVar ?? "OPENAI_API_KEY"],
      baseURL: config.baseUrl,   // ローカル LLM や他社 API への向け先変更
    });
  }

  async run(options: RunOptions): Promise<RunResult> {
    const messages = buildOpenAIMessages(options.messages, options.systemPrompt);

    const response = await this.client.chat.completions.create({
      model: options.model ?? this.config.defaultModel,
      messages,
      max_tokens: options.maxTokens,
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      },
    };
  }
}

export interface OpenAICompatAdapterConfig {
  apiKey?: string;           // 直接指定（任意）
  apiKeyEnvVar?: string;     // 環境変数名（例: "ANTHROPIC_API_KEY", "GROQ_API_KEY"）
  baseUrl?: string;          // 例: "http://localhost:11434/v1"（Ollama）
  defaultModel: string;      // 必須（例: "gpt-4.1", "llama3.3", "deepseek-coder-v3"）
}
```

#### 対応プロバイダー例

本アダプターは **OpenAI Chat Completions 互換**のエンドポイントのみを対象とする。**Anthropic Messages API**（`https://api.anthropic.com/...`）はリクエスト形式が異なるため、**Claude を使う場合は `claude-agent` アダプターを用いること。**

| プロバイダー | baseUrl | 用途例 |
|---|---|---|
| OpenAI API | `https://api.openai.com/v1`（既定値） | GPT-5.4 等 |
| Groq | `https://api.groq.com/openai/v1` | llama-3.3-70b 等 |
| Ollama（ローカル） | `http://localhost:11434/v1` | llama3.3, mistral 等 |
| LM Studio（ローカル） | `http://localhost:1234/v1` | ローカルモデル全般 |

---

## ドキュメント注入プロトコル（DIP）

### 注入方式

外部文書を `assistant` ロールとして会話履歴に挿入することで、モデルに「自分が過去に出力した」と認識させる。

```typescript
// src/core/injection-engine.ts

export interface InjectionConfig {
  document: string;           // 注入するドキュメント本文
  injectionRole: "assistant"; // 常に assistant
  triggerPrompt?: string;     // 注入前に置く user メッセージ（任意）
}

export function buildInjectedHistory(config: InjectionConfig): Message[] {
  const history: Message[] = [];

  // 1. トリガープロンプトを user ロールで先置き（任意）
  if (config.triggerPrompt) {
    history.push({
      role: "user",
      content: config.triggerPrompt,
    });
  }

  // 2. 文書を assistant ロールとして注入（所有権の錯覚）
  history.push({
    role: "assistant",
    content: config.document,
  });

  return history;
}
```

### デフォルトトリガープロンプト

```
以下の仕様書ドキュメントを作成しました。これをベースに作業を続けます。
```

### 注入後の会話例

```
[messages array]
  { role: "user",      content: "以下の仕様書ドキュメントを作成しました。" }
  { role: "assistant", content: "# EvolveDoc 仕様書\n\n..." }  ← 外部文書
  { role: "user",      content: "この仕様書の不足点を指摘し、補完してください。" }
```

### コンテキスト引き継ぎ（モデルスイッチング時）

異なるアダプターへ切り替える際、蓄積された会話履歴を丸ごと次のアダプターへ渡す。

```typescript
// src/core/evolution-runner.ts

async function switchAdapter(
  currentHistory: Message[],
  nextAdapter: LLMAdapter,
  nextPrompt: string,
  options: RunOptions
): Promise<RunResult> {
  // 現在の会話履歴 + 新しい user プロンプトを結合して渡す
  const nextMessages: Message[] = [
    ...currentHistory,
    { role: "user", content: nextPrompt },
  ];

  return nextAdapter.run({ ...options, messages: nextMessages });
}
```

---

## エージェントループ仕様

### EvolutionStep（進化ステップ）

```typescript
export interface EvolutionStep {
  adapterId: string;          // 使用するアダプターの名前
  prompt: string;             // このステップで投げる user プロンプト
  model?: string;             // モデル名（アダプター既定値を上書き）
  outputKey?: string;         // 出力を保存する際のキー名
  maxTokens?: number;         // OpenAI 互換: max_tokens（プラン既定を上書き）
  maxAgentTurns?: number;     // claude-agent: SDK の maxTurns（プラン既定を上書き）
}
```

### EvolutionPlan（実行計画）

```typescript
export interface EvolutionPlan {
  name: string;               // プラン名（ログ・ファイル名用）
  inputFile: string;          // 注入する初期ドキュメントのパス
  outputFile: string;         // 最終出力ファイルのパス
  triggerPrompt?: string;     // カスタムトリガープロンプト（任意）
  steps: EvolutionStep[];     // 実行するステップのリスト
  saveIntermediates?: boolean; // 中間出力を保存するか（デフォルト: false）
  maxSteps?: number;          // 先頭から最大何ステップまで実行するか（任意）
  maxTokens?: number;         // 既定の max_tokens（OpenAI 互換アダプター向け）
  maxAgentTurns?: number;     // 既定の maxTurns（claude-agent 向け）
}
```

### 実行フロー

```typescript
// src/core/evolution-runner.ts

export async function runEvolution(
  plan: EvolutionPlan,
  registry: AdapterRegistry
): Promise<void> {
  // 1. ドキュメント読み込み
  const document = await loadDocument(plan.inputFile);

  // 2. 初期会話履歴を構築（注入）
  let history: Message[] = buildInjectedHistory({
    document,
    injectionRole: "assistant",
    triggerPrompt: plan.triggerPrompt,
  });

  let lastOutput = document;

  const steps = plan.maxSteps != null ? plan.steps.slice(0, plan.maxSteps) : plan.steps;

  // 3. ステップを順に実行
  for (const step of steps) {
    const adapter = registry.get(step.adapterId);

    console.log(`[EvolveDoc] Step: ${step.adapterId} / ${step.prompt.slice(0, 40)}...`);

    // user プロンプトを履歴に追加
    history.push({ role: "user", content: step.prompt });

    // LLM に投げる（maxTokens / maxAgentTurns はプランとステップでマージ）
    const result = await adapter.run({
      messages: history,
      model: step.model,
      maxTokens: step.maxTokens ?? plan.maxTokens,
      maxAgentTurns: step.maxAgentTurns ?? plan.maxAgentTurns,
    });

    lastOutput = result.content;

    // assistant 応答を履歴に追加（次のステップへ引き継ぐ）
    history.push({ role: "assistant", content: lastOutput });

    // 中間出力保存（オプション）
    if (plan.saveIntermediates && step.outputKey) {
      await saveFile(`${plan.outputFile}.${step.outputKey}.md`, lastOutput);
    }
  }

  // 4. 最終出力を保存
  await saveFile(plan.outputFile, lastOutput);
  console.log(`[EvolveDoc] 完了 → ${plan.outputFile}`);
}
```

---

## 設定仕様

### 設定ファイル（`evolvedoc.config.json`）

```jsonc
{
  "adapters": {
    "claude": {
      "type": "claude-agent",
      "defaultModel": "claude-sonnet-4-6",
      "allowedTools": []
    },
    "codex": {
      "type": "codex-sdk",
      "defaultModel": "gpt-5.4",
      "persistThread": false,
      "skipGitRepoCheck": false
    },
    "local": {
      "type": "openai-compat",
      "baseUrl": "http://localhost:11434/v1",
      "apiKeyEnvVar": "OLLAMA_API_KEY",
      "defaultModel": "llama3.3"
    },
    "openai": {
      "type": "openai-compat",
      "apiKeyEnvVar": "OPENAI_API_KEY",
      "defaultModel": "gpt-4.1"
    }
  }
}
```

### プランファイル（`*.plan.json`）

```jsonc
{
  "name": "spec-review",
  "inputFile": "./docs/spec-draft.md",
  "outputFile": "./docs/spec-evolved.md",
  "triggerPrompt": "以下の仕様書ドキュメントを作成しました。これをベースに作業を続けます。",
  "saveIntermediates": true,
  "steps": [
    {
      "adapterId": "claude",
      "prompt": "この仕様書の技術的な矛盾・曖昧な表現・不足セクションを列挙してください。",
      "outputKey": "review"
    },
    {
      "adapterId": "codex",
      "prompt": "前のレビュー結果を踏まえ、仕様書を改善・加筆してください。コードサンプルも充実させてください。",
      "model": "gpt-5.3-codex",
      "outputKey": "improved"
    },
    {
      "adapterId": "claude",
      "prompt": "最終的に全体を整理し、読みやすい Markdown 形式に整えてください。",
      "outputKey": "final"
    }
  ]
}
```

---

## ディレクトリ構成

```
evolve-doc/
├── RESEARCH.md                       # 依存・SDK の調査メモ
├── bun.lock
├── bin/
│   └── evolvedoc                     # CLI エントリ（shebang: bun）
├── src/
│   ├── adapters/
│   │   ├── types.ts                  # 共通インターフェース定義
│   │   ├── serialize.ts              # 履歴シリアライズ・OpenAI メッセージ変換
│   │   ├── claude-agent.adapter.ts   # Claude Agent SDK アダプター
│   │   ├── codex-sdk.adapter.ts      # Codex SDK アダプター
│   │   ├── openai-compat.adapter.ts  # OpenAI 互換 API アダプター
│   │   └── registry.ts               # アダプターレジストリ（遅延生成）
│   ├── core/
│   │   ├── injection-engine.ts       # ドキュメント注入エンジン
│   │   ├── evolution-runner.ts       # 進化ループ実行
│   │   └── document-loader.ts        # ファイル読み込み・正規化
│   ├── config/
│   │   ├── schema.ts                 # Zod スキーマ定義
│   │   └── loader.ts                 # 設定ファイル読み込み
│   ├── cli/
│   │   └── index.ts                  # CLI エントリーポイント
│   └── index.ts                      # ライブラリエントリーポイント
├── docs/
│   └── examples/                     # サンプルプランファイル
├── test/                             # Vitest ユニットテスト
├── vitest.config.ts
├── evolvedoc.config.example.json     # 設定テンプレート
├── evolvedoc.config.json             # アダプター設定（ユーザー作成）
├── package.json
├── tsconfig.json
└── README.md
```

---

## セキュリティ考慮事項

### 個人利用前提のセキュリティモデル

本フレームワークは個人利用を想定しており、マルチユーザー・サービス公開は対象外とする。

| リスク | 対策 |
|---|---|
| API キーの漏洩 | 設定ファイルに直接記述せず、環境変数経由で取得する |
| プロンプトインジェクション | 注入する文書が信頼できる自作ファイルであることを前提とする |
| 意図しないファイル操作 | Claude Agent SDK / Codex SDK の `allowedTools` を必要最小限に制限する |
| トークン消費の暴走 | `maxTokens` および `maxSteps`（任意）で上限を設ける |

### 認証情報の管理

```bash
# .env ファイルで管理（.gitignore に追加すること）
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
```

---

## 制約・既知の制限

### Claude Agent SDK

- **peer 依存**: `zod ^4.0.0` が宣言されている。プロジェクトの Zod  major を 4 に合わせること
- **第三者向け提供は禁止**: Anthropic の方針により、`claude.ai` サブスクリプションを第三者製品のレート制限として提供することは原則禁止。個人利用の範囲内で使用すること
- **CLI 依存**: `claude` CLI コマンドが事前にインストール・ログイン済みである必要がある
- **コンテキスト引き継ぎの制限**: Claude Agent SDK は毎回新規セッションを開始するため、会話履歴は `prompt` 引数へのシリアライズで引き継ぐ

### Codex SDK

- **TypeScript 専用**: Python SDK は現時点で未提供
- **Git リポジトリが推奨**: Codex SDK はデフォルトで Git リポジトリを前提とする。非 Git ディレクトリでは `skipGitRepoCheck` が必要
- **サブスクリプション接続**: `codex` CLI でのログインが事前に必要

### OpenAI 互換アダプター

- **`assistant` ロール注入の挙動差異**: プロバイダーによっては `assistant` ターンの取り扱いが異なる場合がある（Ollama 等のローカルモデルでは要検証）
- **コンテキストウィンドウ制限**: 長い会話履歴はモデルのコンテキスト上限に達する場合がある。長期ループでは要注意

### 共通

- **ステートレス**: フレームワーク自体はセッション状態を永続化しない。再開には出力ファイルを再注入する必要がある
- **並列実行未対応**: 現バージョン（v1.0）ではステップは逐次実行のみ

---

*EvolveDoc v1.0.0 — 個人利用向け軽量フレームワーク仕様書*