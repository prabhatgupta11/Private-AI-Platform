import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { ensureDocumentsSchema, getDb } from "../../../db";
import { documents } from "../../../db/schema";

export const runtime = "edge";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const allowedExtensions = new Set([
  "pdf", "doc", "docx", "txt", "csv", "xls", "xlsx", "md", "html", "htm",
  "xml", "json", "ppt", "pptx", "png", "jpg", "jpeg", "webp", "tiff", "tif",
  "mp3", "wav", "m4a", "mp4", "mov", "webm", "zip", "py", "js", "ts", "tsx",
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

export async function GET() {
  try {
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
    await ensureDocumentsSchema();
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

      await env.DOCUMENTS.put(objectKey, file.stream(), {
        httpMetadata: { contentType },
        customMetadata: { originalName: file.name, documentId: id },
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
        await env.DOCUMENTS.delete(objectKey);
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

    await env.DOCUMENTS.delete(document.objectKey);
    await db.delete(documents).where(eq(documents.id, id));
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
