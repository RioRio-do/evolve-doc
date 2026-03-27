import OpenAI from "openai";
import type { LLMAdapter, RunOptions, RunResult } from "./types";
import { buildOpenAIMessages } from "./serialize";

export interface OpenAICompatAdapterConfig {
  apiKey?: string;
  apiKeyEnvVar?: string;
  baseUrl?: string;
  defaultModel: string;
}

export class OpenAICompatAdapter implements LLMAdapter {
  readonly name = "openai-compat";
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(private readonly config: OpenAICompatAdapterConfig) {
    const envVar = config.apiKeyEnvVar ?? "OPENAI_API_KEY";
    const apiKey = config.apiKey ?? process.env[envVar];
    this.client = new OpenAI({
      apiKey,
      baseURL: config.baseUrl,
    });
    this.defaultModel = config.defaultModel;
  }

  async run(options: RunOptions): Promise<RunResult> {
    const base = this.config.baseUrl ?? "";
    if (base.includes("api.anthropic.com") || base.includes("anthropic.com/v1")) {
      throw new Error(
        "openai-compat targets OpenAI Chat Completions-compatible APIs only. Anthropic Messages API is not supported here — use adapter type \"claude-agent\" instead."
      );
    }

    const messages = buildOpenAIMessages(options.messages, options.systemPrompt);

    const response = await this.client.chat.completions.create({
      model: options.model ?? this.defaultModel,
      messages,
      max_tokens: options.maxTokens,
    });

    const choice = response.choices[0];
    const raw = choice?.message?.content;
    const content = typeof raw === "string" ? raw : "";

    return {
      content,
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      },
    };
  }
}
