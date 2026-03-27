#!/usr/bin/env bun
import { Command } from "commander";
import { resolve } from "node:path";
import chalk from "chalk";
import { loadEvolutionPlan, loadEvolvedocConfig } from "../config/loader";
import { buildRegistryFromConfig } from "../adapters/registry";
import { runEvolution } from "../core/evolution-runner";

const program = new Command();

program
  .name("evolvedoc")
  .description("EvolveDoc — multi-LLM document evolution")
  .version("1.0.0");

program
  .command("run")
  .description("Run an evolution plan")
  .argument("<plan>", "Path to *.plan.json")
  .option("-c, --config <path>", "Adapter config JSON", "evolvedoc.config.json")
  .action(async (planPath: string, opts: { config: string }) => {
    const cwd = process.cwd();
    const configPath = resolve(cwd, opts.config);
    const planFile = resolve(cwd, planPath);

    const config = await loadEvolvedocConfig(configPath);
    const plan = await loadEvolutionPlan(planFile);
    const registry = buildRegistryFromConfig(config.adapters);

    try {
      await runEvolution(plan, registry, {
        log: (m) => console.log(chalk.dim(m)),
      });
    } finally {
      await registry.disposeAll();
    }
  });

program.parse();
