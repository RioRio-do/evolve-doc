import { z } from "zod";

const claudeAgentSchema = z.object({
  type: z.literal("claude-agent"),
  defaultModel: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  cliPath: z.string().optional(),
});

const codexSdkSchema = z.object({
  type: z.literal("codex-sdk"),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().optional(),
  persistThread: z.boolean().optional(),
  skipGitRepoCheck: z.boolean().optional(),
});

const openaiCompatSchema = z.object({
  type: z.literal("openai-compat"),
  apiKey: z.string().optional(),
  apiKeyEnvVar: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().min(1),
});

const adapterEntrySchema = z.discriminatedUnion("type", [
  claudeAgentSchema,
  codexSdkSchema,
  openaiCompatSchema,
]);

export const evolvedocConfigSchema = z.object({
  adapters: z.record(z.string(), adapterEntrySchema),
});

export type EvolvedocConfig = z.infer<typeof evolvedocConfigSchema>;
export type AdapterConfigEntry = z.infer<typeof adapterEntrySchema>;

export const evolutionStepSchema = z.object({
  adapterId: z.string().min(1),
  prompt: z.string(),
  model: z.string().optional(),
  outputKey: z.string().optional(),
});

export const evolutionPlanSchema = z.object({
  name: z.string().min(1),
  inputFile: z.string().min(1),
  outputFile: z.string().min(1),
  triggerPrompt: z.string().optional(),
  saveIntermediates: z.boolean().optional(),
  steps: z.array(evolutionStepSchema).min(1),
});

export type EvolutionPlan = z.infer<typeof evolutionPlanSchema>;
export type EvolutionStep = z.infer<typeof evolutionStepSchema>;
