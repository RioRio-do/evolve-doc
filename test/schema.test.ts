import { describe, expect, it } from "vitest";
import { evolvedocConfigSchema, evolutionPlanSchema } from "../src/config/schema";

describe("evolvedocConfigSchema", () => {
  it("parses a valid config", () => {
    const cfg = evolvedocConfigSchema.parse({
      adapters: {
        openai: {
          type: "openai-compat",
          apiKeyEnvVar: "OPENAI_API_KEY",
          defaultModel: "gpt-4.1",
        },
      },
    });
    expect(cfg.adapters.openai.type).toBe("openai-compat");
  });
});

describe("evolutionPlanSchema", () => {
  it("parses a minimal plan", () => {
    const plan = evolutionPlanSchema.parse({
      name: "t",
      inputFile: "./in.md",
      outputFile: "./out.md",
      steps: [{ adapterId: "openai", prompt: "go" }],
    });
    expect(plan.steps).toHaveLength(1);
  });
});
