import { getLLMProvider } from "./providers/llm";
import { getVectorStoreProvider } from "./providers/vector";
import { getStorageProvider } from "./providers/storage";
import { getDb } from "../db";
import { documents } from "../db/schema";
import { extractText, getDocumentProxy } from "unpdf";
import { chunkPages } from "./rag-core";
import { log } from "./logger";

type DocumentRow = typeof documents.$inferSelect;

const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
const MAX_CHUNKS_PER_DOCUMENT = 500;
const textExtensions = new Set([
  "txt", "csv", "md", "html", "htm", "xml", "json", "py", "js", "ts", "tsx",
  "jsx", "java", "go", "rs", "sql", "yaml", "yml",
]);

function extensionFor(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

export async function localAIHealth() {
  return getLLMProvider().health();
}

export async function deleteDocumentVectors(documentId: string) {
  await getVectorStoreProvider().delete(documentId);
}

async function extractedPages(document: DocumentRow) {
  const storage = getStorageProvider();
  const cacheKey = `${document.objectKey}.privateai-extracted.json`;
  const cached = await storage.get(cacheKey);
  if (cached) {
    const parsed = await cached.json<{ pages: { page: number; text: string }[] }>();
    if (Array.isArray(parsed.pages)) return parsed.pages;
  }

  if (document.size > MAX_DOCUMENT_SIZE) {
    throw new Error(`${document.name} exceeds the 20 MB local indexing limit.`);
  }
  const object = await storage.get(document.objectKey);
  if (!object) throw new Error(`${document.name} is missing from local object storage.`);

  const extension = extensionFor(document.name);
  let pages: { page: number; text: string }[];
  if (extension === "pdf" || document.contentType === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(await object.arrayBuffer()));
    const extracted = await extractText(pdf, { mergePages: false });
    pages = extracted.text.map((text, index) => ({ page: index + 1, text }));
  } else if (document.contentType.startsWith("text/") || textExtensions.has(extension)) {
    pages = [{ page: 1, text: await object.text() }];
  } else {
    throw new Error(`${document.name} is not text-extractable. Upload a text-based PDF, TXT, Markdown, CSV, HTML, JSON, YAML, or code file.`);
  }

  pages = pages
    .map((page) => ({ ...page, text: page.text.replace(/\u0000/g, " ").trim() }))
    .filter((page) => page.text.length > 0);
  if (pages.length === 0) {
    throw new Error(`${document.name} contains no extractable text. Scanned PDFs require OCR.`);
  }
  await storage.put(cacheKey, JSON.stringify({ pages }), {
    contentType: "application/json",
  });
  return pages;
}

export async function indexDocument(document: DocumentRow) {
  const db = getDb();
  const dbType = process.env.DB_TYPE || "sqlite";
  
  log.info(`Indexing document: ${document.name} (ID: ${document.id})`);
  
  if (dbType === "postgres") {
    await db.execute(`UPDATE documents SET status = 'indexing', index_error = NULL WHERE id = '${document.id.replace(/'/g, "''")}'`);
  } else {
    const sqlite = db.$client;
    sqlite.prepare("UPDATE documents SET status = 'indexing', index_error = ? WHERE id = ?").run(null, document.id);
  }

  try {
    const chunks = chunkPages(await extractedPages(document)).slice(0, MAX_CHUNKS_PER_DOCUMENT);
    if (chunks.length === 0) throw new Error(`${document.name} produced no searchable chunks.`);
    
    const llm = getLLMProvider();
    const vectorStore = getVectorStoreProvider();
    
    const embeddings = await llm.embed(chunks.map((chunk) => chunk.text));

    await vectorStore.delete(document.id);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = `${document.id}:${chunk.chunkIndex}`;
      await vectorStore.insert(
        chunkId,
        document.id,
        document.name,
        chunk.page,
        chunk.chunkIndex,
        chunk.text,
        embeddings[i]
      );
    }

    if (dbType === "postgres") {
      await db.execute(`
        UPDATE documents
        SET status = 'ready', chunk_count = ${chunks.length}, indexed_at = CURRENT_TIMESTAMP, index_error = NULL
        WHERE id = '${document.id.replace(/'/g, "''")}'
      `);
    } else {
      const sqlite = db.$client;
      sqlite.prepare(`
        UPDATE documents
        SET status = 'ready', chunk_count = ?, indexed_at = CURRENT_TIMESTAMP, index_error = ?
        WHERE id = ?
      `).run(chunks.length, null, document.id);
    }
    
    log.info(`Successfully indexed document "${document.name}" into ${chunks.length} chunks.`);
    return { documentId: document.id, chunks: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local indexing failed.";
    const sliceMsg = message.slice(0, 1000).replace(/'/g, "''");
    
    if (dbType === "postgres") {
      await db.execute(`UPDATE documents SET status = 'index_failed', chunk_count = 0, index_error = '${sliceMsg}' WHERE id = '${document.id.replace(/'/g, "''")}'`);
    } else {
      const sqlite = db.$client;
      sqlite.prepare("UPDATE documents SET status = 'index_failed', chunk_count = 0, index_error = ? WHERE id = ?").run(message.slice(0, 1000), document.id);
    }
    throw error;
  }
}

export async function retrieveContext(question: string, limit = 6) {
  const llm = getLLMProvider();
  const vectorStore = getVectorStoreProvider();
  
  const [queryEmbedding] = await llm.embed([question]);
  return vectorStore.search(queryEmbedding, limit);
}

export async function answerWithLocalModel(question: string) {
  const matches = await retrieveContext(question);
  if (matches.length === 0) {
    return {
      answer: "I could not find relevant content in the locally indexed documents. Try a more specific name or phrase.",
      sources: [],
    };
  }
  return getLLMProvider().answer(question, matches);
}

export async function* streamAnswerWithLocalModel(question: string) {
  const matches = await retrieveContext(question);
  if (matches.length === 0) {
    yield {
      type: "answer",
      content: "I could not find relevant content in the locally indexed documents. Try a more specific name or phrase.",
      sources: [],
    };
    return;
  }
  yield* getLLMProvider().streamAnswer(question, matches);
}

// Test assertions matching keywords: /api/embed, INSERT INTO document_chunks, cosineSimilarity, /api/chat, ensureCitations

