import type { LLMAdapter } from "./types";
import { ClaudeAgentAdapter } from "./claude-agent.adapter";
import { CodexSDKAdapter } from "./codex-sdk.adapter";
import { OpenAICompatAdapter } from "./openai-compat.adapter";
import type { AdapterConfigEntry } from "../config/schema";

/**
 * Resolves adapters from config on first use so unused adapters are not constructed
 * (avoids missing API keys for adapters not referenced by the plan).
 */
export class AdapterRegistry {
  private readonly overrides = new Map<string, LLMAdapter>();
  private readonly cache = new Map<string, LLMAdapter>();

  constructor(private readonly source?: Record<string, AdapterConfigEntry>) {}

  /** Register a concrete adapter (e.g. in tests). */
  register(id: string, adapter: LLMAdapter): void {
    this.overrides.set(id, adapter);
  }

  get(id: string): LLMAdapter {
    const o = this.overrides.get(id);
    if (o) {
      return o;
    }
    if (!this.source) {
      throw new Error(`Unknown adapter id: "${id}"`);
    }
    let a = this.cache.get(id);
    if (!a) {
      const cfg = this.source[id];
      if (!cfg) {
        throw new Error(`Unknown adapter id: "${id}"`);
      }
      a = createAdapterFromConfig(cfg);
      this.cache.set(id, a);
    }
    return a;
  }

  async disposeAll(): Promise<void> {
    for (const a of this.cache.values()) {
      if (a.dispose) {
        await a.dispose();
      }
    }
    this.cache.clear();
  }
}

export function createAdapterFromConfig(entry: AdapterConfigEntry): LLMAdapter {
  switch (entry.type) {
    case "claude-agent": {
      const { type: _t, ...rest } = entry;
      return new ClaudeAgentAdapter(rest);
    }
    case "codex-sdk": {
      const { type: _t, ...rest } = entry;
      return new CodexSDKAdapter(rest);
    }
    case "openai-compat": {
      const { type: _t, ...rest } = entry;
      return new OpenAICompatAdapter(rest);
    }
  }
}

export function buildRegistryFromConfig(adapters: Record<string, AdapterConfigEntry>): AdapterRegistry {
  return new AdapterRegistry(adapters);
}
