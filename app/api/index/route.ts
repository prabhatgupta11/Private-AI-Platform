import { desc, inArray } from "drizzle-orm";
import { ensureDocumentsSchema, getDb } from "../../../db";
import { documents } from "../../../db/schema";
import { indexDocument, localAIHealth } from "../../local-rag";
import { isAuthorized, checkRateLimit } from "../auth";
import { getVectorStoreProvider } from "../../providers/vector";
import { log } from "../../logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    log.warn("GET /api/index - Unauthorized access attempt");
    return Response.json({ error: "Unauthorized access." }, { status: 401 });
  }
  if (!checkRateLimit(request, 60)) {
    log.warn("GET /api/index - Rate limit exceeded");
    return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }
  await ensureDocumentsSchema();
  const health = await localAIHealth();
  const counts = await getVectorStoreProvider().counts();
  return Response.json({
    ...health,
    vectorStore: {
      type: process.env.VECTOR_DB_TYPE || "local-sqlite",
      chunks: counts.chunks,
      indexedDocuments: counts.indexedDocuments,
    },
  }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      log.warn("POST /api/index - Unauthorized access attempt");
      return Response.json({ error: "Unauthorized access." }, { status: 401 });
    }
    if (!checkRateLimit(request, 30)) {
      log.warn("POST /api/index - Rate limit exceeded");
      return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    await ensureDocumentsSchema();
    const health = await localAIHealth();
    if (!health.ready) {
      const reason = health.reachable
        ? `Missing local models: ${health.missingModels.join(", ")}.`
        : "Local Ollama is not running.";
      return Response.json({ error: `${reason} Run \`npm run local:setup\`.`, localAI: health }, { status: 400 });
    }

    const payload = request.headers.get("content-type")?.includes("application/json")
      ? await request.json() as { documentIds?: unknown }
      : {};
    const documentIds = Array.isArray(payload.documentIds)
      ? payload.documentIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];

    const db = getDb();
    const rows = documentIds.length
      ? await db.select().from(documents).where(inArray(documents.id, documentIds))
      : await db.select().from(documents).orderBy(desc(documents.createdAt)).limit(100);
    const indexed = [];
    const failed = [];
    for (const document of rows) {
      try {
        indexed.push(await indexDocument(document));
      } catch (error) {
        failed.push({
          documentId: document.id,
          name: document.name,
          error: error instanceof Error ? error.message : "Indexing failed.",
        });
      }
    }
    return Response.json({ indexed, failed }, { status: failed.length && !indexed.length ? 422 : 200 });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Unable to index local documents.",
    }, { status: 500 });
  }
}
