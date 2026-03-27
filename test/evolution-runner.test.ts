import { describe, expect, it } from "vitest";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runEvolution } from "../src/core/evolution-runner";
import { AdapterRegistry } from "../src/adapters/registry";
import type { LLMAdapter, RunOptions, RunResult } from "../src/adapters/types";

class EchoAdapter implements LLMAdapter {
  readonly name = "echo";
  async run(options: RunOptions): Promise<RunResult> {
    const lastUser = [...options.messages].reverse().find((m) => m.role === "user");
    return { content: `ECHO:${lastUser?.content ?? ""}` };
  }
}

describe("runEvolution", () => {
  it("runs steps and writes output", async () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), "tmp-evolve");
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const inputFile = join(dir, "in.md");
    const outputFile = join(dir, "out.md");
    await writeFile(inputFile, "# Hello", "utf8");

    const registry = new AdapterRegistry();
    registry.register("echo", new EchoAdapter());

    await runEvolution(
      {
        name: "test",
        inputFile,
        outputFile,
        triggerPrompt: "t",
        steps: [{ adapterId: "echo", prompt: "step1" }],
      },
      registry,
      { log: () => {} }
    );

    const out = await readFile(outputFile, "utf8");
    expect(out).toContain("ECHO:step1");
  });
});
