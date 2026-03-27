# EvolveDoc 仕様適合 再レビュー報告書

- 再レビュー日時: 2026-03-27
- 基準: `spec.md`
- 結論: 前回指摘の主要項目はほぼ修正済み。実装上の重大な仕様逸脱は見当たらず、残件は仕様書内の軽微な記述不整合 1 件。

## 確認結果

- `cliPath` は Claude SDK の `pathToClaudeCodeExecutable` に接続された。`src/adapters/claude-agent.adapter.ts:17-28`
- Claude の `result` は配列で収集して結合するよう修正された。`src/adapters/claude-agent.adapter.ts:17-39`
- `openai-compat` は Anthropic Messages API 非対応を明示し、実行時にも拒否するようになった。`src/adapters/openai-compat.adapter.ts:25-31`
- `maxSteps` / `maxTokens` / `maxAgentTurns` がスキーマとランナー経由で利用可能になった。`src/config/schema.ts:40-64`, `src/core/evolution-runner.ts:32-50`
- `DocumentLoader` は JSON を parse 後に整形文字列へ正規化するようになった。`src/core/document-loader.ts:15-24`
- Codex の `dispose()` については、公開 SDK に削除 API がない前提へ仕様書側が修正され、実装説明と整合した。`src/adapters/codex-sdk.adapter.ts:58-63`, `spec.md:344-346`
- 依存バージョンの記述も `package.json` と整合するよう更新された。`package.json:34-38`, `spec.md:167-170`, `RESEARCH.md:87-88`

## 残件

### Low: `RunOptions` の仕様スニペットだけが `maxAgentTurns` を反映できていない

- 実装根拠: `src/adapters/types.ts:6-17`
- 仕様根拠: `spec.md:191-196`
- 詳細:
  - 実装の `RunOptions` には `maxAgentTurns?: number` が追加されている。
  - しかし `spec.md` の「共通インターフェース」コードスニペットには `maxAgentTurns` がまだ載っていない。
  - 一方で、同じ `spec.md` の後半では `EvolutionStep.maxAgentTurns` と `EvolutionPlan.maxAgentTurns`、および Claude への `maxTurns` マッピングが記載されている。`spec.md:501-518`, `spec.md:554-559`
- 影響:
  - 実装バグではない。
  - ただし仕様書だけ読むと、`RunOptions` が `maxAgentTurns` を受ける事実を見落とす。
- 推奨:
  - `spec.md` の `RunOptions` スニペットへ `maxAgentTurns?: number` を追加して統一する。

## テスト結果

- `bun run test`: 成功
- `bun run typecheck`: 成功

## 最終判定

- 以前の主要指摘は解消済み。
- 現時点では、仕様達成度は実質的に良好。
- 残るのは `spec.md` 内の軽微な記述不整合のみで、コード修正を要する未達は確認できなかった。
