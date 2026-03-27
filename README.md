# EvolveDoc

複数の LLM アダプターを切り替えながらドキュメントを反復改善する軽量フレームワーク。仕様は [spec.md](./spec.md)、依存・SDK の調査は [RESEARCH.md](./RESEARCH.md) を参照。

## 要件

- [Bun](https://bun.sh) 1.x

## セットアップ

```bash
bun install
```

## 設定

1. `evolvedoc.config.example.json` を `evolvedoc.config.json` にコピーし、アダプター定義を編集する。
2. 必要な API キーまたは CLI ログイン（Claude / Codex）を用意する。

## 実行

プラン（`* .plan.json`）を用意し、次で実行する。

```bash
bun run src/cli/index.ts run ./path/to/plan.json --config ./evolvedoc.config.json
```

または `PATH` に `bin` を通したうえで:

```bash
./bin/evolvedoc run ./path/to/plan.json
```

## 開発

```bash
bun run typecheck
bun run test
```

## ライセンス

仕様書（spec.md）に準拠。依存パッケージは各ライセンスに従う。
