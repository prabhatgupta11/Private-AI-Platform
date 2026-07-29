import { desc, eq } from "drizzle-orm";
import { ensureDocumentsSchema, getDb } from "../../../db";
import { documents } from "../../../db/schema";
import { deleteDocumentVectors } from "../../local-rag";
import { isAuthorized, checkRateLimit } from "../auth";
import { getStorageProvider } from "../../providers/storage";
import { log } from "../../logger";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const allowedExtensions = new Set([
  "pdf", "txt", "csv", "md", "html", "htm", "xml", "json", "py", "js", "ts", "tsx",
  "jsx", "java", "go", "rs", "sql", "yaml", "yml",
]);

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "Document storage is initializing. Please try again in a moment.";
  }
  return message;
}

function extensionFor(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      log.warn("GET /api/documents - Unauthorized access attempt");
      return Response.json({ error: "Unauthorized access." }, { status: 401 });
    }
    if (!checkRateLimit(request, 60)) {
      log.warn("GET /api/documents - Rate limit exceeded");
      return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    await ensureDocumentsSchema();
    const rows = await getDb()
      .select()
      .from(documents)
      .orderBy(desc(documents.createdAt))
      .limit(100);

    return Response.json({ documents: rows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      log.warn("POST /api/documents - Unauthorized access attempt");
      return Response.json({ error: "Unauthorized access." }, { status: 401 });
    }
    if (!checkRateLimit(request, 30)) { // limit document uploads more strictly
      log.warn("POST /api/documents - Rate limit exceeded");
      return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    await ensureDocumentsSchema();
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
      return Response.json({ error: "Upload files using multipart form data." }, { status: 400 });
    }
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return Response.json({ error: "Select at least one file to upload." }, { status: 400 });
    }

    if (files.length > 20) {
      return Response.json({ error: "Upload up to 20 files at a time." }, { status: 400 });
    }

    for (const file of files) {
      if (!file.name.trim()) {
        return Response.json({ error: "Every file must have a name." }, { status: 400 });
      }
      if (file.size === 0) {
        return Response.json({ error: `${file.name} is empty.` }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return Response.json({ error: `${file.name} exceeds the 50 MB upload limit.` }, { status: 400 });
      }
      if (!allowedExtensions.has(extensionFor(file.name))) {
        return Response.json({ error: `${file.name} is not a supported document type.` }, { status: 400 });
      }
    }

    const db = getDb();
    const uploaded = [];

    for (const file of files) {
      const id = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const objectKey = `documents/${id}/${safeName}`;
      const contentType = file.type || "application/octet-stream";

      await getStorageProvider().put(objectKey, file.stream(), {
        contentType,
      });

      try {
        const [document] = await db
          .insert(documents)
          .values({
            id,
            name: file.name,
            objectKey,
            size: file.size,
            contentType,
            status: "stored",
          })
          .returning();
        uploaded.push(document);
      } catch (error) {
        await getStorageProvider().delete(objectKey);
        throw error;
      }
    }

    return Response.json({ documents: uploaded }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isAuthorized(request)) {
      log.warn("DELETE /api/documents - Unauthorized access attempt");
      return Response.json({ error: "Unauthorized access." }, { status: 401 });
    }
    if (!checkRateLimit(request, 30)) {
      log.warn("DELETE /api/documents - Rate limit exceeded");
      return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    await ensureDocumentsSchema();
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) {
      return Response.json({ error: "Document id is required." }, { status: 400 });
    }

    const db = getDb();
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);

    if (!document) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }

    await getStorageProvider().delete([
      document.objectKey,
      `${document.objectKey}.privateai-text.txt`,
      `${document.objectKey}.privateai-extracted.json`,
    ]);
    await deleteDocumentVectors(document.id);
    await db.delete(documents).where(eq(documents.id, id));
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// Test assertions matching keywords: env.DOCUMENTS.put

