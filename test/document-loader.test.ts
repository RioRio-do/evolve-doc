import { describe, expect, it } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDocument } from "../src/core/document-loader";

const dir = join(dirname(fileURLToPath(import.meta.url)), "tmp-loader");

describe("loadDocument", () => {
  it("pretty-prints JSON files", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const p = join(dir, "x.json");
    await writeFile(p, '{"b":1,"a":2}', "utf8");
    const { body } = await loadDocument(p);
    expect(body).toContain('"a"');
    expect(body).toContain('"b"');
    const round = JSON.parse(body);
    expect(round).toEqual({ b: 1, a: 2 });
    await rm(dir, { recursive: true, force: true });
  });
});
