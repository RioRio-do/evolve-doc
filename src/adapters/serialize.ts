import type { Message } from "./types";

const ROLE_LABEL: Record<Message["role"], string> = {
  user: "User",
  assistant: "Assistant",
  system: "System",
};

/** Serialize chat history into a single prompt for agent-style adapters (Claude Agent, Codex). */
export function serializeMessages(messages: Message[]): string {
  return messages.map((m) => `## ${ROLE_LABEL[m.role]}\n${m.content}`).join("\n\n");
}

/** Build OpenAI-style message list; optional system line becomes leading system message. */
export function buildOpenAIMessages(
  messages: Message[],
  systemPrompt?: string
): { role: "system" | "user" | "assistant"; content: string }[] {
  const out: { role: "system" | "user" | "assistant"; content: string }[] = [];
  if (systemPrompt?.trim()) {
    out.push({ role: "system", content: systemPrompt.trim() });
  }
  for (const m of messages) {
    if (m.role === "system") {
      out.push({ role: "system", content: m.content });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}
