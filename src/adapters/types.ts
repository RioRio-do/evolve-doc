export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface RunOptions {
  messages: Message[];
  systemPrompt?: string;
  /** Passed to OpenAI Chat Completions `max_tokens` where supported. */
  maxTokens?: number;
  /**
   * Claude Agent SDK only: maps to `options.maxTurns` (agent loop cap).
   * Ignored by other adapters.
   */
  maxAgentTurns?: number;
  model?: string;
}

export interface RunResult {
  content: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface LLMAdapter {
  readonly name: string;
  run(options: RunOptions): Promise<RunResult>;
  dispose?(): Promise<void>;
}
