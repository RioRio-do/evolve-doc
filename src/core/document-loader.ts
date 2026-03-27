import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import matter from "gray-matter";

export interface LoadedDocument {
  body: string;
  extension: string;
}

/** Load a document from disk; Markdown is parsed with gray-matter (content only). */
export async function loadDocument(filePath: string): Promise<LoadedDocument> {
  const raw = await readFile(filePath, "utf8");
  const ext = extname(filePath).toLowerCase();

  if (ext === ".md" || ext === ".markdown") {
    const { content } = matter(raw);
    return { body: content.trim(), extension: ext };
  }

  return { body: raw, extension: ext || ".txt" };
}
