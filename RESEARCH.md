# EvolveDoc — 技術調査メモ（2026-03-27）

本ドキュメントは `spec.md`（旧ドラフト）と実装時点の **npm レジストリ・公式ドキュメント** を突き合わせた調査記録である。EvolveDoc 1.0.0 の依存選定と API 実装の根拠とする。

---

## 1. 調査サマリ（ドラフト仕様との差分）

| 項目 | ドラフト仕様の記述 | 調査時点の事実 |
|------|-------------------|----------------|
| Claude Agent SDK | `ClaudeAgentOptions` を `new` して `query` に渡す | **TypeScript** では `query({ prompt, options: { ... } })` の **プレーンオブジェクト**が公式。Python とは API 形状が異なる。 |
| Claude Agent SDK バージョン | `^0.2.83` | **0.2.85**（npm `latest`）。パッケージに **peerDependencies: `zod ^4.0.0`** が宣言されている。Zod 3 では依存解決が合わない。 |
| Codex SDK スレッド再開 | `startThread({ id })` 風の記述 | 公式は **`resumeThread(threadId)`**。新規は `startThread()`。 |
| パッケージマネージャ | npm / pnpm | プロジェクト方針として **Bun**（`bun install` / `bun run`）。 |
| `openai` | `^5.x` | npm **latest は 6.x 系**（例: 6.33.0）。Chat Completions の利用パターンは継続利用可能。1.0 では `^6` を採用。 |
| `@openai/codex-sdk` | `latest` 固定 | **セマバーで固定**（調査時 **0.117.0**）。再現性のため `^0.117.0` 等で記載。 |

---

## 2. Claude Agent SDK（`@anthropic-ai/claude-agent-sdk`）

- **npm**: [https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
- **公式概要**: [Agent SDK overview](https://docs.claude.com/en/api/agent-sdk/overview)
- **エンジン**: `engines.node >= 18.0.0`
- **モジュール**: `type: module`、エントリ `sdk.mjs`
- **peerDependencies**: `zod ^4.0.0`（npm メタデータより）
- **認証・ポリシー**: ドキュメント上、**API キー（Console）** を推奨。第三者が **claude.ai ログインやレート制限を自製品に組み込む**ことは、原則として Anthropic の承認なしでは不可、という趣旨の記載がある（overview の認証節を参照）。
- **EvolveDoc での使い方**: 会話履歴を **単一 `prompt` 文字列にシリアライズ**し、`query({ prompt, options })` に渡す。エージェントは Claude Code 相当のツール実行を行うため、**テキストのみ**にしたい場合は `allowedTools: []` 等で制限する（仕様書の意図と一致）。

---

## 3. Codex SDK（`@openai/codex-sdk`）

- **公式**: [Codex SDK](https://developers.openai.com/codex/sdk/)
- **要件**: **Node.js 18 以上**（サーバーサイド利用）
- **基本 API**: `new Codex()` → `startThread()` → `thread.run(prompt)`。過去スレッドは `resumeThread(threadId)`。
- **Git リポジトリ**: CLI/SDK は作業ディレクトリを **Git 管理下**とみなすことが多い。非 Git 環境では **`startThread` / `resumeThread` の `ThreadOptions.skipGitRepoCheck`** を使う（`Codex` コンストラクタではない）。

---

## 4. OpenAI 互換クライアント（`openai`）

- **npm**: 現行メジャーは **6.x**（調査時 6.33.0）。`OpenAI` クラスと `chat.completions.create` による互換エンドポイント利用は従来通り。
- **用途**: OpenAI 本番、および `baseURL` を差し替えた **Ollama / LM Studio / Groq** 等の OpenAI 互換 API。

---

## 5. Bun（ランタイム / パッケージマネージャ）

- **公式**: [https://bun.sh](https://bun.sh)
- **子プロセス**: [Child processes / Spawn](https://bun.com/docs/runtime/child-process) — SDK が内部でプロセスを起動する場合の互換性の参照先。
- **方針**: 本リポジトリでは **Bun をパッケージマネージャ兼実行環境**とする。Claude/Codex SDK は Node 向けだが、Bun は Node API の互換実装を提供する。実機では `bun run` で CLI を起動し、問題があれば README に回避策（例: `node` での実行）を記す。

---

## 6. 実装メモ（EvolveDoc 1.0）

- **アダプター解決**: `AdapterRegistry` はプランで参照される `adapterId` のアダプターのみ遅延生成する。未使用のエントリのために API キーを要求しない。

## 7. 参考 URL 一覧

| 内容 | URL |
|------|-----|
| Claude Agent SDK overview | https://docs.claude.com/en/api/agent-sdk/overview |
| Claude Agent SDK（npm） | https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk |
| Codex SDK | https://developers.openai.com/codex/sdk/ |
| Codex TypeScript ソースツリー | https://github.com/openai/codex/tree/main/sdk/typescript |
| Bun ドキュメント | https://bun.sh/docs |
| Bun Spawn | https://bun.com/docs/runtime/child-process |

---

## 8. devDependencies のバージョン

- 仕様書 1.0 の依存表は `typescript ^6.x`、 `@types/node ^25.x`、 `vitest ^4.x` と、`package.json` の実ロックと一致させる（TypeScript 5 系固定の記述は廃止）。

---

*本調査は実装ロックファイル（`bun.lock`）と `package.json` の依存と併せて更新すること。*
