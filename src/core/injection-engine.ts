import type { Message } from "../adapters/types";

export interface InjectionConfig {
  document: string;
  injectionRole: "assistant";
  triggerPrompt?: string;
}

export function buildInjectedHistory(config: InjectionConfig): Message[] {
  const history: Message[] = [];

  if (config.triggerPrompt) {
    history.push({
      role: "user",
      content: config.triggerPrompt,
    });
  }

  history.push({
    role: "assistant",
    content: config.document,
  });

  return history;
}
