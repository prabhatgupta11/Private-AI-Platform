import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  objectKey: text("object_key").notNull().unique(),
  size: integer("size").notNull(),
  contentType: text("content_type").notNull(),
  status: text("status").notNull().default("stored"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
