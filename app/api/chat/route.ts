import { desc } from "drizzle-orm";
import { ensureDocumentsSchema, getDb } from "../../../db";
import { documents } from "../../../db/schema";
import {
  answerWithLocalModel,
  indexDocument,
  localAIHealth,
  streamAnswerWithLocalModel,
} from "../../local-rag";
import { isAuthorized, checkRateLimit } from "../auth";
import { log } from "../../logger";

export const runtime = "nodejs";

const MAX_QUESTION_LENGTH = 1000;
const MAX_DOCUMENTS = 20;

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      log.warn("POST /api/chat - Unauthorized access attempt");
      return Response.json({ error: "Unauthorized access." }, { status: 401 });
    }
    if (!checkRateLimit(request, 30)) {
      log.warn("POST /api/chat - Rate limit exceeded");
      return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return Response.json({ error: "Send the question as JSON." }, { status: 400 });
    }

    const payload = await request.json() as { question?: unknown; stream?: boolean };
    const question = typeof payload.question === "string" ? payload.question.trim() : "";
    if (!question) {
      return Response.json({ error: "Question is required." }, { status: 400 });
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      return Response.json({ error: "Question must be 1,000 characters or fewer." }, { status: 400 });
    }

    await ensureDocumentsSchema();
    const health = await localAIHealth();
    if (!health.reachable) {
      return Response.json({
        error: "Local Ollama is not running. Start Ollama, then run `npm run local:setup`.",
        localAI: health,
      }, { status: 503 });
    }
    if (!health.ready) {
      return Response.json({
        error: `Local models are missing: ${health.missingModels.join(", ")}. Run \`npm run local:setup\`.`,
        localAI: health,
      }, { status: 503 });
    }

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

    const indexingErrors: { name: string; error: string }[] = [];
    for (const document of rows.filter((row: typeof documents.$inferSelect) => row.status !== "ready")) {
      try {
        await indexDocument(document);
      } catch (error) {
        indexingErrors.push({
          name: document.name,
          error: error instanceof Error ? error.message : "Indexing failed.",
        });
      }
    }

    const acceptsEventStream = request.headers.get("accept")?.includes("text/event-stream");
    const wantsStream = payload.stream === true || (payload.stream !== false && acceptsEventStream);

    if (wantsStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const generator = streamAnswerWithLocalModel(question);
            for await (const chunk of generator) {
              if (chunk.type === "sources") {
                controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify(chunk.sources)}\n\n`));
              } else if (chunk.type === "text") {
                controller.enqueue(encoder.encode(`event: text\ndata: ${JSON.stringify({ content: chunk.content })}\n\n`));
              } else if (chunk.type === "answer") {
                controller.enqueue(encoder.encode(`event: answer\ndata: ${JSON.stringify({ content: chunk.content, sources: chunk.sources })}\n\n`));
              }
            }
            controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            controller.close();
          } catch (err) {
            log.error("Streaming error in /api/chat:", err);
            const errMsg = err instanceof Error ? err.message : "Error during streaming response.";
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errMsg })}\n\n`));
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const result = await answerWithLocalModel(question);
    return Response.json({
      ...result,
      searchedDocuments: rows.length - indexingErrors.length,
      indexingErrors,
      pipeline: [
        "extracted_text",
        "chunking",
        "local_embedding",
        "local_vector_search",
        "relevant_context",
        "local_llm",
        "cited_answer",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to answer from local documents.";
    return Response.json({ error: message }, { status: 500 });
  }
}

