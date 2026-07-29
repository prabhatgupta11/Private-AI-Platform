import { env } from "cloudflare:workers";
import { extractText, getDocumentProxy } from "unpdf";
import type { documents } from "../db/schema";
import { buildGroundedPrompt, chunkPages, cosineSimilarity, ensureCitations } from "./rag-core";
import { log } from "./logger";

type DocumentRow = typeof documents.$inferSelect;
type RuntimeEnv = typeof env & {
  OLLAMA_BASE_URL?: string;
  OLLAMA_CHAT_MODEL?: string;
  OLLAMA_EMBED_MODEL?: string;
};

type StoredChunkRow = {
  id: string;
  document_id: string;
  document_name: string;
  page: number;
  chunk_index: number;
  text: string;
  embedding: string;
};

export type CitationSource = {
  citation: string;
  documentId: string;
  name: string;
  page: number;
  excerpt: string;
  score: number;
};

const embeddingCache = new Map<string, number[]>();

const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
const MAX_CHUNKS_PER_DOCUMENT = 500;
const EMBEDDING_BATCH_SIZE = 24;
const textExtensions = new Set([
  "txt", "csv", "md", "html", "htm", "xml", "json", "py", "js", "ts", "tsx",
  "jsx", "java", "go", "rs", "sql", "yaml", "yml",
]);

function config() {
  const runtime = env as RuntimeEnv;
  return {
    baseUrl: (runtime.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
    chatModel: runtime.OLLAMA_CHAT_MODEL || "qwen2.5:3b",
    embedModel: runtime.OLLAMA_EMBED_MODEL || "nomic-embed-text",
  };
}

function extensionFor(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function localServiceError(error: unknown) {
  const detail = error instanceof Error ? error.message : "Unknown local service error";
  if (/fetch failed|ECONNREFUSED|connect/i.test(detail)) {
    return new Error("The local Ollama service is not reachable. Start Ollama, then run `npm run local:setup`.");
  }
  return error instanceof Error ? error : new Error(detail);
}

async function ollamaRequest(path: string, body?: unknown) {
  const { baseUrl } = config();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(120_000),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || `Ollama returned HTTP ${response.status}.`);
    }
    return payload;
  } catch (error) {
    throw localServiceError(error);
  }
}

export async function localAIHealth() {
  const { chatModel, embedModel, baseUrl } = config();
  try {
    const payload = await ollamaRequest("/api/tags") as { models?: { name: string; model?: string }[] };
    const installed = (payload.models ?? []).flatMap((model) => [model.name, model.model].filter(Boolean));
    const hasModel = (wanted: string) => installed.some((name) =>
      name === wanted || name === `${wanted}:latest` || name?.startsWith(`${wanted}:`));
    return {
      ready: hasModel(chatModel) && hasModel(embedModel),
      reachable: true,
      baseUrl,
      chatModel,
      embedModel,
      missingModels: [chatModel, embedModel].filter((model) => !hasModel(model)),
    };
  } catch (error) {
    return {
      ready: false,
      reachable: false,
      baseUrl,
      chatModel,
      embedModel,
      missingModels: [chatModel, embedModel],
      error: error instanceof Error ? error.message : "Ollama is unavailable.",
    };
  }
}

async function embedTexts(inputs: string[]) {
  const { embedModel } = config();
  const embeddings: number[][] = [];
  for (let offset = 0; offset < inputs.length; offset += EMBEDDING_BATCH_SIZE) {
    const input = inputs.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const payload = await ollamaRequest("/api/embed", { model: embedModel, input }) as {
      embeddings?: number[][];
    };
    if (!payload.embeddings || payload.embeddings.length !== input.length) {
      throw new Error(`The local embedding model ${embedModel} returned an invalid response.`);
    }
    embeddings.push(...payload.embeddings);
  }
  return embeddings;
}

async function extractedPages(document: DocumentRow) {
  const cacheKey = `${document.objectKey}.privateai-extracted.json`;
  const cached = await env.DOCUMENTS.get(cacheKey);
  if (cached) {
    const parsed = await cached.json<{ pages: { page: number; text: string }[] }>();
    if (Array.isArray(parsed.pages)) return parsed.pages;
  }

  if (document.size > MAX_DOCUMENT_SIZE) {
    throw new Error(`${document.name} exceeds the 20 MB local indexing limit.`);
  }
  const object = await env.DOCUMENTS.get(document.objectKey);
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
  await env.DOCUMENTS.put(cacheKey, JSON.stringify({ pages }), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { sourceDocumentId: document.id },
  });
  return pages;
}

export async function deleteDocumentVectors(documentId: string) {
  try {
    const chunks = await env.DB.prepare("SELECT id FROM document_chunks WHERE document_id = ?").bind(documentId).all<{ id: string }>();
    if (chunks.results) {
      for (const row of chunks.results) {
        embeddingCache.delete(row.id);
      }
    }
  } catch (error) {
    log.warn(`Could not evict deleted vectors from memory cache: ${error instanceof Error ? error.message : error}`);
  }
  await env.DB.prepare("DELETE FROM document_chunks WHERE document_id = ?").bind(documentId).run();
}

export async function indexDocument(document: DocumentRow) {
  log.info(`Indexing document: ${document.name} (ID: ${document.id})`);
  await env.DB.prepare(
    "UPDATE documents SET status = 'indexing', index_error = NULL WHERE id = ?"
  ).bind(document.id).run();
  try {
    const chunks = chunkPages(await extractedPages(document)).slice(0, MAX_CHUNKS_PER_DOCUMENT);
    if (chunks.length === 0) throw new Error(`${document.name} produced no searchable chunks.`);
    const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));

    await deleteDocumentVectors(document.id);
    for (let offset = 0; offset < chunks.length; offset += 50) {
      const statements = chunks.slice(offset, offset + 50).map((chunk, batchIndex) => {
        const index = offset + batchIndex;
        return env.DB.prepare(`
          INSERT INTO document_chunks
            (id, document_id, document_name, page, chunk_index, text, embedding)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          `${document.id}:${chunk.chunkIndex}`,
          document.id,
          document.name,
          chunk.page,
          chunk.chunkIndex,
          chunk.text,
          JSON.stringify(embeddings[index]),
        );
      });
      await env.DB.batch(statements);
    }
    await env.DB.prepare(`
      UPDATE documents
      SET status = 'ready', chunk_count = ?, indexed_at = CURRENT_TIMESTAMP, index_error = NULL
      WHERE id = ?
    `).bind(chunks.length, document.id).run();
    log.info(`Successfully indexed document "${document.name}" into ${chunks.length} chunks.`);
    return { documentId: document.id, chunks: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local indexing failed.";
    await env.DB.prepare(`
      UPDATE documents SET status = 'index_failed', chunk_count = 0, index_error = ? WHERE id = ?
    `).bind(message.slice(0, 1000), document.id).run();
    throw error;
  }
}

export async function retrieveContext(question: string, limit = 6) {
  log.info(`Retrieving context for: "${question.slice(0, 60)}..."`);
  const [queryEmbedding] = await embedTexts([question]);
  const result = await env.DB.prepare(`
    SELECT id, document_id, document_name, page, chunk_index, text, embedding
    FROM document_chunks
    LIMIT 10000
  `).all<StoredChunkRow>();

  log.info(`Scanned ${result.results?.length || 0} chunks from SQLite. Performing cosine checks...`);

  const matches = (result.results || [])
    .map((row) => {
      let vector = embeddingCache.get(row.id);
      if (!vector) {
        vector = JSON.parse(row.embedding) as number[];
        embeddingCache.set(row.id, vector);
      }
      return {
        row,
        score: cosineSimilarity(queryEmbedding, vector),
      };
    })
    .filter((match) => Number.isFinite(match.score) && match.score > 0.2)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((match, index) => ({
      citation: `[S${index + 1}]`,
      documentId: match.row.document_id,
      documentName: match.row.document_name,
      page: match.row.page,
      chunkIndex: match.row.chunk_index,
      text: match.row.text,
      score: match.score,
    }));

  log.info(`Identified ${matches.length} matching context segments.`);
  return matches;
}

export async function answerWithLocalModel(question: string) {
  const matches = await retrieveContext(question);
  if (matches.length === 0) {
    return {
      answer: "I could not find relevant content in the locally indexed documents. Try a more specific name or phrase.",
      sources: [] as CitationSource[],
    };
  }
  const { chatModel } = config();
  const payload = await ollamaRequest("/api/chat", {
    model: chatModel,
    stream: false,
    options: { temperature: 0.1 },
    messages: [
      {
        role: "system",
        content: "You are a private document assistant. Answer only from the supplied context. Cite factual claims with the exact source labels such as [S1]. If the context is insufficient, say so. Never invent a fact or citation.",
      },
      { role: "user", content: buildGroundedPrompt(question, matches) },
    ],
  }) as { message?: { content?: string } };
  const rawAnswer = payload.message?.content?.trim();
  if (!rawAnswer) throw new Error(`The local model ${chatModel} returned an empty answer.`);
  return {
    answer: ensureCitations(rawAnswer, matches),
    sources: matches.map((match) => ({
      citation: match.citation,
      documentId: match.documentId,
      name: match.documentName,
      page: match.page,
      excerpt: match.text.slice(0, 240),
      score: Number(match.score.toFixed(4)),
    })),
  };
}

export async function* streamAnswerWithLocalModel(question: string) {
  const matches = await retrieveContext(question);
  if (matches.length === 0) {
    yield {
      type: "answer",
      content: "I could not find relevant content in the locally indexed documents. Try a more specific name or phrase.",
      sources: []
    };
    return;
  }

  // Yield retrieved matches to frontend first
  yield {
    type: "sources",
    sources: matches.map((match) => ({
      citation: match.citation,
      documentId: match.documentId,
      name: match.documentName,
      page: match.page,
      excerpt: match.text.slice(0, 240),
      score: Number(match.score.toFixed(4)),
    }))
  };

  const { chatModel, baseUrl } = config();
  log.info(`Requesting streaming chat completion from Ollama: ${chatModel}`);

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: chatModel,
      stream: true,
      options: { temperature: 0.1 },
      messages: [
        {
          role: "system",
          content: "You are a private document assistant. Answer only from the supplied context. Cite factual claims with the exact source labels such as [S1]. If the context is insufficient, say so. Never invent a fact or citation.",
        },
        { role: "user", content: buildGroundedPrompt(question, matches) },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama stream request failed: HTTP ${response.status} - ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Ollama response has no readable stream.");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
          const chunk = parsed.message?.content || "";
          if (chunk) {
            yield { type: "text", content: chunk };
          }
        } catch {
          // ignore parsing error on raw tags
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer) as { message?: { content?: string } };
        const chunk = parsed.message?.content || "";
        if (chunk) yield { type: "text", content: chunk };
      } catch {}
    }
  } finally {
    reader.releaseLock();
  }
}

