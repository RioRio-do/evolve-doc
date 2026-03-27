import { query } from "@anthropic-ai/claude-agent-sdk";
import type { LLMAdapter, RunOptions, RunResult } from "./types";
import { serializeMessages } from "./serialize";

export interface ClaudeAgentAdapterConfig {
  defaultModel?: string;
  allowedTools?: string[];
  cliPath?: string;
}

export class ClaudeAgentAdapter implements LLMAdapter {
  readonly name = "claude-agent";

  constructor(private readonly config: ClaudeAgentAdapterConfig) {}

  async run(options: RunOptions): Promise<RunResult> {
    const serializedHistory = serializeMessages(options.messages);

    const resultChunks: string[] = [];
    for await (const message of query({
      prompt: serializedHistory,
      options: {
        systemPrompt: options.systemPrompt,
        model: options.model ?? this.config.defaultModel,
        allowedTools: this.config.allowedTools ?? [],
        permissionMode: "acceptEdits",
        ...(this.config.cliPath ? { pathToClaudeCodeExecutable: this.config.cliPath } : {}),
        ...(options.maxAgentTurns != null ? { maxTurns: options.maxAgentTurns } : {}),
      },
    })) {
      if (message.type === "result") {
        if (message.subtype === "success") {
          resultChunks.push(message.result);
        } else {
          const err =
            "errors" in message && message.errors.length
              ? message.errors.join("; ")
              : message.subtype;
          throw new Error(`Claude Agent SDK finished with error: ${err}`);
        }
      }
    }

    return { content: resultChunks.join("") };
  }
}
