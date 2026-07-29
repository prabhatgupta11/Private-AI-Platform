import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export async function ensureDocumentsSchema() {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }

  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        object_key TEXT NOT NULL UNIQUE,
        size INTEGER NOT NULL,
        content_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'stored',
        chunk_count INTEGER NOT NULL DEFAULT 0,
        indexed_at TEXT,
        index_error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS documents_object_key_unique ON documents (object_key)"
    ),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL,
        document_name TEXT NOT NULL,
        page INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        embedding TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks (document_id)"
    ),
  ]);

  const columns = await env.DB.prepare("PRAGMA table_info(documents)").all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  const additions = [
    ["chunk_count", "ALTER TABLE documents ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 0"],
    ["indexed_at", "ALTER TABLE documents ADD COLUMN indexed_at TEXT"],
    ["index_error", "ALTER TABLE documents ADD COLUMN index_error TEXT"],
  ] as const;
  for (const [name, statement] of additions) {
    if (!names.has(name)) await env.DB.prepare(statement).run();
  }
}
