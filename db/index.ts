import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { log } from "../app/logger";
import path from "node:path";
import fs from "node:fs";

let sqliteDbClient: any = null;
let pgPoolClient: any = null;

function getSqliteClient() {
  if (!sqliteDbClient) {
    const dataDir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, "privateai.db");
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqliteDbClient = drizzleSqlite(sqlite, { schema });
    log.info(`Initialized SQLite database at: ${dbPath}`);
  }
  return sqliteDbClient;
}

function getPgClient() {
  if (!pgPoolClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required for PostgreSQL mode.");
    }
    const pool = new pg.Pool({ connectionString });
    pgPoolClient = drizzlePg(pool, { schema });
    log.info("Initialized PostgreSQL database connection pool.");
  }
  return pgPoolClient;
}

export function getDb() {
  const dbType = process.env.DB_TYPE || "sqlite";
  if (dbType === "postgres") {
    return getPgClient();
  }
  return getSqliteClient();
}

export async function runRawSql(sqlText: string) {
  const db = getDb();
  const dbType = process.env.DB_TYPE || "sqlite";
  if (dbType === "postgres") {
    await db.execute(sql.raw(sqlText));
  } else {
    const sqlite = (db as any).$client;
    sqlite.exec(sqlText);
  }
}

export async function ensureDocumentsSchema() {
  const dbType = process.env.DB_TYPE || "sqlite";

  // Create tables
  await runRawSql(`
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
  `);

  await runRawSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS documents_object_key_unique ON documents (object_key)
  `);

  await runRawSql(`
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
  `);

  await runRawSql(`
    CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks (document_id)
  `);

  // Schema migrations checking
  const db = getDb();
  let names = new Set<string>();

  if (dbType === "postgres") {
    const res = await db.execute(sql.raw(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'documents'
    `));
    names = new Set((res.rows || res).map((row: any) => row.column_name || row[0]));
  } else {
    const sqlite = (db as any).$client;
    const columns = sqlite.prepare("PRAGMA table_info(documents)").all() as { name: string }[];
    names = new Set(columns.map((column) => column.name));
  }

  const additions = [
    ["chunk_count", "ALTER TABLE documents ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 0"],
    ["indexed_at", "ALTER TABLE documents ADD COLUMN indexed_at TEXT"],
    ["index_error", "ALTER TABLE documents ADD COLUMN index_error TEXT"],
  ] as const;

  for (const [name, statement] of additions) {
    if (!names.has(name)) {
      await runRawSql(statement);
    }
  }
}
