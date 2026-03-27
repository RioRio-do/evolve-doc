import { readFile } from "node:fs/promises";
import { evolvedocConfigSchema, evolutionPlanSchema, type EvolvedocConfig, type EvolutionPlan } from "./schema";

export async function loadEvolvedocConfig(path: string): Promise<EvolvedocConfig> {
  const raw = await readFile(path, "utf8");
  const json: unknown = JSON.parse(raw);
  return evolvedocConfigSchema.parse(json);
}

export async function loadEvolutionPlan(path: string): Promise<EvolutionPlan> {
  const raw = await readFile(path, "utf8");
  const json: unknown = JSON.parse(raw);
  return evolutionPlanSchema.parse(json);
}
