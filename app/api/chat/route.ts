import { desc } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { extractText, getDocumentProxy } from "unpdf";
import { ensureDocumentsSchema, getDb } from "../../../db";
import { documents } from "../../../db/schema";
import { answerFromDocuments } from "../../retrieval";

export const runtime = "edge";

const MAX_QUESTION_LENGTH = 1000;
const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024;
const MAX_DOCUMENTS = 12;
const textExtensions = new Set([
  "txt", "csv", "md", "html", "htm", "xml", "json", "py", "js", "ts", "tsx",
  "jsx", "java", "go", "rs", "sql", "yaml", "yml",
]);

function extensionFor(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

async function extractDocumentText(document: typeof documents.$inferSelect) {
  const cacheKey = `${document.objectKey}.privateai-text.txt`;
  const cached = await env.DOCUMENTS.get(cacheKey);
  if (cached) return cached.text();

  if (document.size > MAX_DOCUMENT_SIZE) return null;
  const object = await env.DOCUMENTS.get(document.objectKey);
  if (!object) return null;

  const extension = extensionFor(document.name);
  let text: string | null = null;

  if (extension === "pdf" || document.contentType === "application/pdf") {
    const buffer = await object.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const extracted = await extractText(pdf, { mergePages: true });
    text = extracted.text;
  } else if (document.contentType.startsWith("text/") || textExtensions.has(extension)) {
    text = await object.text();
  }

  const cleaned = text?.replace(/\u0000/g, " ").trim();
  if (!cleaned) return null;

  await env.DOCUMENTS.put(cacheKey, cleaned, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
    customMetadata: { sourceDocumentId: document.id },
  });
  return cleaned;
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return Response.json({ error: "Send the question as JSON." }, { status: 400 });
    }

    const payload = await request.json() as { question?: unknown };
    const question = typeof payload.question === "string" ? payload.question.trim() : "";
    if (!question) {
      return Response.json({ error: "Question is required." }, { status: 400 });
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      return Response.json({ error: "Question must be 1,000 characters or fewer." }, { status: 400 });
    }

    await ensureDocumentsSchema();
    const rows = await getDb()
      .select()
      .from(documents)
      .orderBy(desc(documents.createdAt))
      .limit(MAX_DOCUMENTS);

    if (rows.length === 0) {
      return Response.json({
        answer: "Upload at least one PDF or text document before asking document-based questions.",
        sources: [],
      });
    }

    const readable = [];
    const failed = [];
    for (const document of rows) {
      try {
        const text = await extractDocumentText(document);
        if (text) readable.push({ name: document.name, text });
      } catch {
        failed.push(document.name);
      }
    }

    if (readable.length === 0) {
      return Response.json({
        answer: "I found uploaded files, but none could be read yet. Text-based PDFs, TXT, Markdown, CSV, HTML, JSON, and code files are currently supported.",
        sources: [],
        unreadable: failed,
      });
    }

    return Response.json({
      ...answerFromDocuments(question, readable),
      searchedDocuments: readable.length,
      unreadable: failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to search documents.";
    return Response.json({ error: message }, { status: 500 });
  }
}
