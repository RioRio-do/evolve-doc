import { Codex, type ThreadOptions } from "@openai/codex-sdk";
import type { LLMAdapter, RunOptions, RunResult } from "./types";
import { serializeMessages } from "./serialize";

export interface CodexSDKAdapterConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  persistThread?: boolean;
  /** Pass `true` when the working directory is not a Git repository. */
  skipGitRepoCheck?: boolean;
}

export class CodexSDKAdapter implements LLMAdapter {
  readonly name = "codex-sdk";
  private readonly codex: Codex;
  private threadId?: string;

  constructor(private readonly config: CodexSDKAdapterConfig) {
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
    let prompt = serializeMessages(options.messages);
    if (options.systemPrompt?.trim()) {
      prompt = `## System\n${options.systemPrompt.trim()}\n\n${prompt}`;
    }
    const model = options.model ?? this.config.defaultModel;
    const tOpts = this.threadOptions(model);

    const thread =
      this.config.persistThread && this.threadId
        ? this.codex.resumeThread(this.threadId, tOpts)
        : this.codex.startThread(tOpts);

    const turn = await thread.run(prompt);

    if (this.config.persistThread && thread.id) {
      this.threadId = thread.id;
    }

    return {
      content: turn.finalResponse ?? "",
      usage: turn.usage
        ? {
            inputTokens: turn.usage.input_tokens,
            outputTokens: turn.usage.output_tokens,
          }
        : undefined,
    };
  }

  /**
   * Clears the in-memory thread id. The Codex SDK persists threads under
   * `~/.codex/sessions`; this project does not delete those files because the
   * public TypeScript SDK does not expose a session-delete API.
   */
  async dispose(): Promise<void> {
    this.threadId = undefined;
  }
}
