import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AdapterRegistry } from "../adapters/registry";
import type { EvolutionPlan } from "../config/schema";
import { loadDocument } from "./document-loader";
import { buildInjectedHistory } from "./injection-engine";

const DEFAULT_TRIGGER =
  "以下の仕様書ドキュメントを作成しました。これをベースに作業を続けます。";

export interface EvolutionRunnerHooks {
  log?: (message: string) => void;
}

export async function runEvolution(
  plan: EvolutionPlan,
  registry: AdapterRegistry,
  hooks: EvolutionRunnerHooks = {}
): Promise<void> {
  const log = hooks.log ?? console.log;

  const { body: document } = await loadDocument(plan.inputFile);

  let history = buildInjectedHistory({
    document,
    injectionRole: "assistant",
    triggerPrompt: plan.triggerPrompt ?? DEFAULT_TRIGGER,
  });

  let lastOutput = document;

  for (const step of plan.steps) {
    const adapter = registry.get(step.adapterId);

    log(`[EvolveDoc] Step: ${step.adapterId} / ${step.prompt.slice(0, 60)}...`);

    history.push({ role: "user", content: step.prompt });

    const result = await adapter.run({
      messages: history,
      model: step.model,
    });

    lastOutput = result.content;
    history.push({ role: "assistant", content: lastOutput });

    if (plan.saveIntermediates && step.outputKey) {
      const intermediatePath = `${plan.outputFile}.${step.outputKey}.md`;
      await saveFile(intermediatePath, lastOutput);
    }
  }

  await saveFile(plan.outputFile, lastOutput);
  log(`[EvolveDoc] 完了 → ${plan.outputFile}`);
}

async function saveFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}
