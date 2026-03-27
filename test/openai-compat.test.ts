import { describe, expect, it } from "vitest";
import { OpenAICompatAdapter } from "../src/adapters/openai-compat.adapter";

describe("OpenAICompatAdapter", () => {
  it("rejects Anthropic Messages base URLs at run time", async () => {
    const adapter = new OpenAICompatAdapter({
      defaultModel: "claude-3-5-sonnet",
      apiKey: "test-key",
      baseUrl: "https://api.anthropic.com/v1",
    });

    await expect(
      adapter.run({
        messages: [{ role: "user", content: "hi" }],
      })
    ).rejects.toThrow(/claude-agent/i);
  });
});
