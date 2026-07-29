import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  objectKey: text("object_key").notNull().unique(),
  size: integer("size").notNull(),
  contentType: text("content_type").notNull(),
  status: text("status").notNull().default("stored"),
  chunkCount: integer("chunk_count").notNull().default(0),
  indexedAt: text("indexed_at"),
  indexError: text("index_error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const documentChunks = sqliteTable("document_chunks", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  documentName: text("document_name").notNull(),
  page: integer("page").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  text: text("text").notNull(),
  embedding: text("embedding").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
