# EvolveDoc

**EvolveDoc** is a lightweight TypeScript framework for **iteratively improving documents** by routing the same evolving context through **different LLM backends** (Claude via the Agent SDK, OpenAI Codex via the Codex SDK, or any **OpenAI-compatible** HTTP API such as OpenAI, Ollama, or Groq).

It is designed for **personal, low-friction workflows**: you keep your spec or README as a file, define a **plan** of steps, and let each step run on the adapter you choose.

For the Japanese version of this document, see [README-ja.md](./README-ja.md).

---

## Table of contents

1. [What problem EvolveDoc solves](#what-problem-evolvedoc-solves)
2. [How it works](#how-it-works)
3. [Architecture](#architecture)
4. [Requirements](#requirements)
5. [Installation](#installation)
6. [Configuration: `evolvedoc.config.json`](#configuration-evolvedocconfigjson)
7. [Evolution plans: `*.plan.json`](#evolution-plans-planjson)
8. [Running the CLI](#running-the-cli)
9. [Using EvolveDoc as a library](#using-evolvedoc-as-a-library)
10. [Security and credentials](#security-and-credentials)
11. [Limitations](#limitations)
12. [Development](#development)
13. [Further reading](#further-reading)

---

## What problem EvolveDoc solves

Typical use cases:

| Use case | Idea |
|----------|------|
| **Spec review** | One model lists contradictions; another rewrites sections. |
| **Doc completion** | Seed a README; another model fills gaps. |
| **Multi-model polish** | Same document passes through several models in sequence. |
| **Cross-model consistency** | One model drafts; another checks for internal consistency. |

EvolveDoc does **not** host a web UI or a shared multi-user service. It runs **on your machine** and talks to providers through their official SDKs or HTTP APIs.

---

## How it works

### Document Injection Protocol (DIP)

Models usually treat **`assistant`** turns as *their own prior output*. EvolveDoc uses that by injecting your **external file** as an **`assistant`** message after an optional **user** “trigger” line. That creates an **ownership illusion**: the model tends to treat the document as something it already produced, which stabilizes follow-up instructions.

Default trigger text in code (override with `triggerPrompt` in your plan if you want another language or wording):

```text
以下の仕様書ドキュメントを作成しました。これをベースに作業を続けます。
```

### Model switching

After injection, each **step** appends a new **user** message, runs the chosen **adapter**, and appends the **assistant** reply to the in-memory history. The full history is passed to the **next** adapter, so the next model sees the same thread—including the injected document as “past assistant output.”

### Evolution loop

1. Load the input file (Markdown front matter is stripped via `gray-matter` for `.md`).
2. Build the initial message list (trigger user → injected assistant document).
3. For each step: resolve adapter → run → append assistant output.
4. Write the **last assistant output** to `outputFile`.
5. Optionally write intermediates to `outputFile.<outputKey>.md` when `saveIntermediates` is true.

---

## Architecture

| Piece | Role |
|-------|------|
| **DocumentLoader** | Reads files; normalizes Markdown body. |
| **InjectionEngine** | Builds the initial `Message[]` with DIP. |
| **EvolutionRunner** | Executes steps, saves outputs. |
| **AdapterRegistry** | **Lazily** constructs only the adapters referenced by your plan (so unused entries do not require API keys). |
| **Adapters** | `claude-agent`, `codex-sdk`, `openai-compat` — all implement `LLMAdapter`. |

Authoritative design and API notes: [spec.md](./spec.md). Dependency and SDK notes: [RESEARCH.md](./RESEARCH.md).

---

## Requirements

- **[Bun](https://bun.sh)** 1.x (package manager and runtime; lockfile: `bun.lock`)

Underlying SDKs target **Node.js 18+** semantics; Bun’s Node compatibility layer is used when running under Bun.

---

## Installation

Clone or copy this repository, then from the project root:

```bash
bun install
```

---

## Configuration: `evolvedoc.config.json`

Place a JSON file next to your project (default filename: **`evolvedoc.config.json`**). It must contain an **`adapters`** object: keys are **adapter IDs** you reference from plans; values are **discriminated** by `"type"`.

Copy and edit the template:

```bash
cp evolvedoc.config.example.json evolvedoc.config.json
```

### Adapter types

#### `claude-agent` (Anthropic Claude Agent SDK)

Runs via the Claude Agent SDK (`query`). Typical fields:

```json
{
  "type": "claude-agent",
  "defaultModel": "claude-sonnet-4-20250514",
  "allowedTools": []
}
```

Use **`allowedTools`: `[]`** for text-only behavior without tool use. You need a working **Claude Code / Claude** CLI setup or API credentials as required by Anthropic’s SDK.

#### `codex-sdk` (OpenAI Codex SDK)

```json
{
  "type": "codex-sdk",
  "defaultModel": "gpt-5.4",
  "persistThread": false,
  "skipGitRepoCheck": true
}
```

- **`skipGitRepoCheck`**: set `true` when the working directory is **not** a Git repository (Codex often assumes Git).
- **`persistThread`**: when `true`, the adapter reuses Codex thread IDs across steps in the same process.

#### `openai-compat` (OpenAI-compatible Chat Completions)

Works with OpenAI’s API or any server that exposes a compatible **`/v1/chat/completions`** surface (Ollama, LM Studio, Groq, etc.):

```json
{
  "type": "openai-compat",
  "apiKeyEnvVar": "OPENAI_API_KEY",
  "defaultModel": "gpt-4.1"
}
```

For a local Ollama-style endpoint:

```json
{
  "type": "openai-compat",
  "baseUrl": "http://localhost:11434/v1",
  "apiKeyEnvVar": "OLLAMA_API_KEY",
  "defaultModel": "llama3.3"
}
```

Set the referenced environment variables before running, or supply `apiKey` in JSON if you accept the risk of committing secrets (not recommended).

---

## Evolution plans: `*.plan.json`

A plan describes **one input file**, **one final output path**, optional **trigger** text, and an ordered list of **steps**.

| Field | Meaning |
|-------|---------|
| `name` | Logical name for logs. |
| `inputFile` | Path to the document to inject (relative paths resolve from the **current working directory**). |
| `outputFile` | Final Markdown/text path to write. |
| `triggerPrompt` | Optional; overrides the default injection trigger. |
| `saveIntermediates` | If `true`, writes `outputFile.<outputKey>.md` per step that defines `outputKey`. |
| `steps` | Ordered list of `{ adapterId, prompt, model?, outputKey? }`. |

**`adapterId`** must match a key under `adapters` in `evolvedoc.config.json`.

Example (`docs/examples/example.plan.json`):

```json
{
  "name": "spec-review",
  "inputFile": "./docs/examples/sample-input.md",
  "outputFile": "./docs/examples/sample-output.md",
  "triggerPrompt": "I created the following specification. Continue from this base.",
  "saveIntermediates": false,
  "steps": [
    {
      "adapterId": "openai",
      "prompt": "Summarize this document in a few bullet points."
    }
  ]
}
```

---

## Running the CLI

The CLI entry is **`evolvedoc`** with a **`run`** subcommand.

```bash
bun run src/cli/index.ts run <path-to-plan.json> [--config <path-to-config.json>]
```

- **`--config` / `-c`**: adapter config file. **Default:** `evolvedoc.config.json` in the **current working directory**.
- Paths in the plan are resolved relative to the **process current working directory**, not the config file’s directory.

Using the bundled executable (ensure it is executable):

```bash
chmod +x ./bin/evolvedoc
./bin/evolvedoc run ./docs/examples/example.plan.json -c ./evolvedoc.config.json
```

Set the appropriate API keys (or complete provider login flows) **before** running. Only adapters **referenced** by the plan are instantiated.

---

## Using EvolveDoc as a library

You can import from `src/index.ts` (or your published entry) to build plans in code, load config with Zod validation, and call `runEvolution` with a custom `AdapterRegistry`:

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

When hacking inside this repo without linking the package name, use a relative import such as `from "./src/index.ts"` (or your bundler’s alias) instead of `"evolve-doc"`.

---

## Security and credentials

- Prefer **environment variables** (`apiKeyEnvVar`) over embedding keys in JSON.
- Treat **injected documents** as trusted input; malicious content could attempt prompt injection.
- Restrict **Claude Agent** tool lists (`allowedTools`) to the minimum you need.
- EvolveDoc is aimed at **personal** use, not multi-tenant hosting.

More detail: [spec.md](./spec.md) (security section).

---

## Limitations

- **Sequential steps only** (no parallel evolution in v1.0).
- **No built-in session persistence** across separate CLI invocations; to continue, re-run with the last saved file as `inputFile` or design your plan accordingly.
- Provider-specific constraints (CLI login, Git assumptions for Codex, context window sizes) apply as documented by each vendor.

---

## Development

```bash
bun run typecheck   # TypeScript
bun run test        # Vitest unit tests
```

---

## Further reading

| Document | Content |
|----------|---------|
| [spec.md](./spec.md) | Full specification (v1.0.0). |
| [RESEARCH.md](./RESEARCH.md) | SDK versions, Bun notes, implementation notes. |

---

## License

This project’s specification and code are provided as-is. Third-party packages (Anthropic, OpenAI, etc.) remain under their respective licenses.
