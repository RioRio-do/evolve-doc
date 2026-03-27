import { describe, expect, it } from "vitest";
import { buildInjectedHistory } from "../src/core/injection-engine";

describe("buildInjectedHistory", () => {
  it("injects document as assistant after optional trigger", () => {
    const h = buildInjectedHistory({
      document: "# Doc",
      injectionRole: "assistant",
      triggerPrompt: "trigger",
    });
    expect(h).toEqual([
      { role: "user", content: "trigger" },
      { role: "assistant", content: "# Doc" },
    ]);
  });

  it("omits user when no trigger", () => {
    const h = buildInjectedHistory({
      document: "body",
      injectionRole: "assistant",
    });
    expect(h).toEqual([{ role: "assistant", content: "body" }]);
  });
});
